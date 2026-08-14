from datetime import datetime

import pycrdt
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.modules.docs.models import DocumentBlock, DocumentYDoc

# Y.Doc shape: root "blocks" is a Y.Array of Y.Map({id, type, text: Y.Text}),
# one entry per paragraph/block, in document order.
BLOCKS_KEY = "blocks"


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


def load_or_create_ydoc(doc_id: int, db: Session) -> pycrdt.Doc:
    """Load the canonical Y.Doc for a document, lazily backfilling it from
    `document_blocks` (and persisting once) the first time it's opened."""
    row = db.get(DocumentYDoc, doc_id)
    if row is not None:
        ydoc = pycrdt.Doc()
        ydoc.apply_update(row.state)
        return ydoc

    blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.doc_id == doc_id)
        .order_by(DocumentBlock.position)
        .all()
    )
    ydoc = new_ydoc_from_blocks(blocks)
    persist_ydoc_state(doc_id, ydoc, db)
    return ydoc


def persist_ydoc_state(doc_id: int, ydoc: pycrdt.Doc, db: Session) -> None:
    """Snapshot the Y.Doc's full state into document_ydocs (the canonical store)."""
    state = ydoc.get_update()
    row = db.get(DocumentYDoc, doc_id)
    if row is None:
        db.add(DocumentYDoc(doc_id=doc_id, state=state))
    else:
        row.state = state
    db.commit()


def ydoc_blocks(ydoc: pycrdt.Doc) -> list[dict]:
    """Read the ordered block list back out of a Y.Doc as plain dicts."""
    blocks_array = ydoc.get(BLOCKS_KEY, type=pycrdt.Array)
    return [block_map.to_py() for block_map in blocks_array]


def mirror_blocks_to_db(doc_id: int, ydoc: pycrdt.Doc, db: Session) -> None:
    """Rewrite `document_blocks` to match the Y.Doc's current state, so
    REST endpoints (doc list/preview) keep working unmodified.

    Delete-all-and-reinsert-in-order: correct and simple since the CRDT
    always hands us the complete, authoritative ordered block list - no
    need for the old BlockCache's dirty/new/deleted incremental tracking.
    """
    blocks = ydoc_blocks(ydoc)
    now = datetime.utcnow()

    db.execute(
        text("DELETE FROM document_blocks WHERE doc_id = :doc_id"),
        {"doc_id": doc_id},
    )
    for position, block in enumerate(blocks):
        db.execute(text("""
            INSERT INTO document_blocks (id, doc_id, type, content, position, updated_at)
            VALUES (:id, :doc_id, :type, :content, :position, :updated_at)
        """), {
            "id": block["id"],
            "doc_id": doc_id,
            "type": block["type"],
            "content": block["text"],
            "position": position,
            "updated_at": now,
        })
    db.commit()


def flush_ydoc(doc_id: int, ydoc: pycrdt.Doc, db: Session) -> None:
    """Persist both the canonical CRDT snapshot and the read-model mirror."""
    persist_ydoc_state(doc_id, ydoc, db)
    mirror_blocks_to_db(doc_id, ydoc, db)
