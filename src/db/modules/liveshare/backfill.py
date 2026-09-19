import json
from dataclasses import dataclass
from datetime import datetime

import pycrdt
from sqlalchemy import insert, text
from sqlalchemy.orm import Session

from db.coordination import max_stream_id
from db.modules.docs.models import DocumentBlock, DocumentVersion, DocumentYDoc



BLOCKS_KEY = "blocks"
ADVISORY_LOCK_NAMESPACE = 7301


@dataclass
class LoadedYDoc:
    state: bytes
    stream_id: str | None
    created: bool


@dataclass
class FlushResult:
    """`prior_state` is what the database held before this flush, so the caller can tell whether another replica wrote in the meantime."""
    prior_state: bytes | None
    merged_state: bytes
    blocks: list[dict]
    stream_id: str | None


def lock_document(db: Session, doc_id: int) -> None:
    """Serializes writers of one document across every backend replica until the transaction ends. A no-op on SQLite, which only supports a single process anyway."""
    if db.get_bind().dialect.name == "postgresql":
        db.execute(
            text("SELECT pg_advisory_xact_lock(:namespace, :doc_id)"),
            {"namespace": ADVISORY_LOCK_NAMESPACE, "doc_id": doc_id},
        )


def new_ydoc_from_blocks(blocks: list[DocumentBlock]) -> pycrdt.Doc:
    """Build a fresh Y.Doc seeded from ordered DocumentBlock rows."""
    ydoc = pycrdt.Doc()
    blocks_array = ydoc.get(BLOCKS_KEY, type=pycrdt.Array)
    with ydoc.transaction():
        for block in blocks:
            blocks_array.append(pycrdt.Map({
                "id": block.id,
                "type": block.type,
                "text": pycrdt.Text(block.content),
            }))
    return ydoc


def load_or_create_ydoc(doc_id: int, db: Session) -> LoadedYDoc:
    """Load the canonical Y.Doc state for a document, lazily backfilling from `document_blocks` on first open.

    Creation happens under the document lock: two replicas that each seeded their own Y.Doc from the same blocks would produce two unrelated histories that duplicate every block when merged."""
    row = db.get(DocumentYDoc, doc_id)
    if row is not None:
        return LoadedYDoc(bytes(row.state), row.stream_id, False)

    lock_document(db, doc_id)
    row = db.query(DocumentYDoc).filter(DocumentYDoc.doc_id == doc_id).populate_existing().first()
    if row is not None:
        loaded = LoadedYDoc(bytes(row.state), row.stream_id, False)
        db.rollback()
        return loaded

    blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.doc_id == doc_id)
        .order_by(DocumentBlock.position)
        .all()
    )
    state = new_ydoc_from_blocks(blocks).get_update()
    store_state(doc_id, state, None, db)
    db.commit()
    return LoadedYDoc(state, None, True)


def read_state(doc_id: int, db: Session) -> bytes | None:
    row = db.get(DocumentYDoc, doc_id)
    return bytes(row.state) if row is not None else None


def persist_ydoc_state(doc_id: int, ydoc: pycrdt.Doc, db: Session) -> None:
    """Replace the document's canonical state with `ydoc`'s and forget the stream position (used when a version is restored)."""
    store_state(doc_id, ydoc.get_update(), None, db)
    db.commit()


def store_state(doc_id: int, state: bytes, stream_id: str | None, db: Session) -> None:
    row = db.get(DocumentYDoc, doc_id)
    if row is None:
        db.add(DocumentYDoc(doc_id=doc_id, state=state, stream_id=stream_id))
    else:
        row.state = state
        row.stream_id = stream_id


def ydoc_blocks(ydoc: pycrdt.Doc) -> list[dict]:
    """Read the ordered block list back out of a Y.Doc as plain dicts."""
    blocks_array = ydoc.get(BLOCKS_KEY, type=pycrdt.Array)
    return [block_map.to_py() for block_map in blocks_array]


def mirror_blocks_to_db(doc_id: int, blocks: list[dict], db: Session) -> None:
    """Rewrite `document_blocks` to match the given blocks (delete-all-and-reinsert-in-order). The caller commits.

    The table is only a derived read model of the Y.Doc, so it must never be able to stop the real state from saving: a block id that appears twice is written once instead of violating the primary key."""
    now = datetime.utcnow()

    rows, seen_ids = [], set()
    for block in blocks:
        if block["id"] in seen_ids:
            continue
        seen_ids.add(block["id"])
        rows.append({
            "id": block["id"],
            "doc_id": doc_id,
            "type": block["type"],
            "content": block["text"],
            "position": len(rows),
            "updated_at": now,
        })

    db.execute(
        text("DELETE FROM document_blocks WHERE doc_id = :doc_id"),
        {"doc_id": doc_id},
    )
    if rows:
        db.execute(insert(DocumentBlock), rows)


def write_snapshot(
    doc_id: int, local_state: bytes, applied_stream_id: str | None, want_blocks: bool, db: Session
) -> FlushResult:
    """Merge a replica's in-memory state into what the database holds, and persist the result plus the read-model mirror in one transaction.

    If the merge adds nothing to what is already stored, which is what every replica but the first finds when several hold the same edits, nothing is rewritten. `want_blocks` asks for the block list even in that case (used for version snapshots).

    Overwriting the stored state with one replica's copy would silently drop edits that another replica already flushed; a CRDT merge under the document lock cannot lose either side. Runs on a worker thread, so it works on its own throwaway Y.Doc and never touches a live room's."""
    lock_document(db, doc_id)
    row = db.query(DocumentYDoc).filter(DocumentYDoc.doc_id == doc_id).populate_existing().first()
    prior_state = bytes(row.state) if row is not None else None

    merged = pycrdt.Doc()
    if prior_state:
        merged.apply_update(prior_state)
    merged.apply_update(local_state)
    merged_state = merged.get_update()
    stream_id = max_stream_id(row.stream_id if row is not None else None, applied_stream_id)

    if prior_state is not None and merged_state == prior_state:
        if row.stream_id != stream_id:
            row.stream_id = stream_id
            db.commit()
        else:
            db.rollback()
        return FlushResult(prior_state, prior_state, ydoc_blocks(merged) if want_blocks else [], stream_id)

    blocks = ydoc_blocks(merged)
    store_state(doc_id, merged_state, stream_id, db)
    mirror_blocks_to_db(doc_id, blocks, db)
    db.commit()
    return FlushResult(prior_state, merged_state, blocks, stream_id)



MAX_VERSIONS_PER_DOC = 50


def create_version_snapshot(doc_id: int, blocks: list[dict], db: Session) -> None:
    """Records `blocks` as a restorable version."""
    if not any(block.get("text", "").strip() for block in blocks):
        return
    db.add(DocumentVersion(doc_id=doc_id, blocks_json=json.dumps(blocks)))
    db.commit()

    stale_ids = (
        db.query(DocumentVersion.id)
        .filter(DocumentVersion.doc_id == doc_id)
        .order_by(DocumentVersion.created_at.desc())
        .offset(MAX_VERSIONS_PER_DOC)
        .all()
    )
    if stale_ids:
        db.query(DocumentVersion).filter(
            DocumentVersion.id.in_([row[0] for row in stale_ids])
        ).delete(synchronize_session=False)
        db.commit()
