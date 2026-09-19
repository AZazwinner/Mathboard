import time

import pycrdt
import pytest

from db.database import SessionLocal
from db.modules.docs.models import DocumentBlock, DocumentYDoc
from db.modules.liveshare.backfill import BLOCKS_KEY, write_snapshot
from tests.test_docs_permissions import create_doc, signup


def state_of(blocks: list[tuple[str, str]]) -> bytes:
    doc = pycrdt.Doc()
    array = doc.get(BLOCKS_KEY, type=pycrdt.Array)
    with doc.transaction():
        for block_id, text in blocks:
            array.append(pycrdt.Map({"id": block_id, "type": "paragraph", "text": pycrdt.Text(text)}))
    return doc.get_update()


def save(doc_id, state, stream_id=None, want_blocks=False):
    with SessionLocal() as db:
        return write_snapshot(doc_id, state, stream_id, want_blocks, db)


def mirror(db_session, doc_id):
    db_session.expire_all()
    return (
        db_session.query(DocumentBlock)
        .filter(DocumentBlock.doc_id == doc_id)
        .order_by(DocumentBlock.position)
        .all()
    )


@pytest.fixture()
def doc_id(client):
    _, token = signup(client, "owner", "owner@example.com")
    return create_doc(client, token)


def test_a_save_that_adds_nothing_does_not_rewrite_the_blocks(doc_id, db_session):
    state = state_of([("a", "one"), ("b", "two")])
    first = save(doc_id, state)
    stamps = [row.updated_at for row in mirror(db_session, doc_id)]

    time.sleep(0.05)
    second = save(doc_id, state)

    assert second.merged_state == second.prior_state == first.merged_state
    assert [row.updated_at for row in mirror(db_session, doc_id)] == stamps


def test_a_save_with_new_content_rewrites_the_blocks(doc_id, db_session):
    save(doc_id, state_of([("a", "one")]))

    doc = pycrdt.Doc()
    doc.apply_update(db_session.get(DocumentYDoc, doc_id).state)
    with doc.transaction():
        doc.get(BLOCKS_KEY, type=pycrdt.Array).append(
            pycrdt.Map({"id": "b", "type": "paragraph", "text": pycrdt.Text("two")})
        )
    save(doc_id, doc.get_update())

    assert [(row.id, row.content) for row in mirror(db_session, doc_id)] == [("a", "one"), ("b", "two")]


def test_a_skipped_save_still_advances_the_stream_position(doc_id, db_session):
    state = state_of([("a", "one")])
    save(doc_id, state, stream_id="5-0")
    save(doc_id, state, stream_id="9-0")

    db_session.expire_all()
    assert db_session.get(DocumentYDoc, doc_id).stream_id == "9-0"


def test_a_skipped_save_never_moves_the_stream_position_backwards(doc_id, db_session):
    state = state_of([("a", "one")])
    save(doc_id, state, stream_id="9-0")
    save(doc_id, state, stream_id="5-0")

    db_session.expire_all()
    assert db_session.get(DocumentYDoc, doc_id).stream_id == "9-0"


def test_the_block_list_is_still_returned_when_nothing_is_written(doc_id):
    state = state_of([("a", "one"), ("b", "two")])
    save(doc_id, state)

    assert save(doc_id, state).blocks == []
    assert [b["id"] for b in save(doc_id, state, want_blocks=True).blocks] == ["a", "b"]


def test_a_duplicate_block_id_cannot_stop_the_real_state_from_saving(doc_id, db_session):
    state = state_of([("dup", "first"), ("other", "middle"), ("dup", "second")])

    save(doc_id, state)

    db_session.expire_all()
    stored = pycrdt.Doc()
    stored.apply_update(db_session.get(DocumentYDoc, doc_id).state)
    assert len(stored.get(BLOCKS_KEY, type=pycrdt.Array)) == 3
    assert [(row.id, row.position) for row in mirror(db_session, doc_id)] == [("dup", 0), ("other", 1)]


def test_saving_a_large_document_writes_every_block_in_order(doc_id, db_session):
    blocks = [(f"b{i}", f"paragraph {i}") for i in range(1500)]
    save(doc_id, state_of(blocks))

    rows = mirror(db_session, doc_id)
    assert [row.id for row in rows] == [block_id for block_id, _ in blocks]
    assert rows[1499].content == "paragraph 1499"
