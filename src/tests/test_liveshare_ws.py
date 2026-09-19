import time

import pycrdt
import pytest
from starlette.websockets import WebSocketDisconnect

from db.modules.docs.models import DocumentBlock, DocumentYDoc
from db.modules.liveshare.backfill import BLOCKS_KEY
from tests.test_docs_permissions import auth, create_doc, signup


@pytest.fixture()
def owner(client):
    return signup(client, "owner", "owner@example.com")


@pytest.fixture()
def other(client):
    return signup(client, "other", "other@example.com")


def share(client, owner_token, doc_id, user_id, share_type):
    resp = client.post(
        "/doc-share",
        json={"doc_id": doc_id, "user_id": user_id, "share_type": share_type},
        headers=auth(owner_token),
    )
    assert resp.json()["success"] is True


def block_content(db_session, block_id):
    db_session.expire_all()
    row = db_session.query(DocumentBlock).filter(DocumentBlock.id == block_id).first()
    return row.content if row is not None else None


def connect(client, doc_id, token):
    return client.websocket_connect(f"/ws/docs/{doc_id}?token={token}")


def new_block_update(block_id, text):
    """A Yjs update that appends one block, as a browser client's edit would."""
    doc = pycrdt.Doc()
    updates = []
    doc.observe(lambda event: updates.append(event.update))
    blocks = doc.get(BLOCKS_KEY, type=pycrdt.Array)
    blocks.append(pycrdt.Map({"id": block_id, "type": "paragraph", "text": pycrdt.Text(text)}))
    return pycrdt.create_update_message(updates[-1])


def test_rejects_a_missing_token(client, owner):
    _, token = owner
    doc_id = create_doc(client, token)

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/ws/docs/{doc_id}"):
            pass
    assert excinfo.value.code == 4401


def test_rejects_a_user_with_no_access(client, owner, other):
    _, owner_token = owner
    _, other_token = other
    doc_id = create_doc(client, owner_token)

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with connect(client, doc_id, other_token):
            pass
    assert excinfo.value.code == 4401


def test_server_opens_with_a_sync_message(client, owner):
    _, token = owner
    doc_id = create_doc(client, token)

    with connect(client, doc_id, token) as ws:
        first = ws.receive_bytes()

    assert first[0] == pycrdt.YMessageType.SYNC


def test_a_writers_edit_is_persisted_on_disconnect(client, owner, db_session):
    _, token = owner
    doc_id = create_doc(client, token)

    with connect(client, doc_id, token) as ws:
        ws.receive_bytes()
        ws.send_bytes(new_block_update("blk-persisted", "hello from the socket"))

    rows = db_session.query(DocumentBlock).filter(DocumentBlock.doc_id == doc_id).all()
    assert [row.content for row in rows if row.id == "blk-persisted"] == ["hello from the socket"]
    state_row = db_session.get(DocumentYDoc, doc_id)
    assert state_row is not None
    restored = pycrdt.Doc()
    restored.apply_update(state_row.state)
    assert any(b["id"] == "blk-persisted" for b in restored.get(BLOCKS_KEY, type=pycrdt.Array).to_py())


def test_an_edit_reaches_the_other_connected_client(client, owner, other):
    owner_id, owner_token = owner
    other_id, other_token = other
    doc_id = create_doc(client, owner_token)
    share(client, owner_token, doc_id, other_id, "write")

    with connect(client, doc_id, owner_token) as writer, connect(client, doc_id, other_token) as reader:
        writer.receive_bytes()
        reader.receive_bytes()

        writer.send_bytes(new_block_update("blk-shared", "visible to both"))
        relayed = reader.receive_bytes()

        replica = pycrdt.Doc()
        pycrdt.handle_sync_message(relayed[1:], replica)
        blocks = replica.get(BLOCKS_KEY, type=pycrdt.Array).to_py()
        assert [b["text"] for b in blocks if b["id"] == "blk-shared"] == ["visible to both"]


def test_a_read_only_user_is_disconnected_for_writing(client, owner, other, db_session):
    owner_id, owner_token = owner
    other_id, other_token = other
    doc_id = create_doc(client, owner_token)
    share(client, owner_token, doc_id, other_id, "read")

    with connect(client, doc_id, other_token) as ws:
        ws.receive_bytes()
        ws.send_bytes(new_block_update("blk-forbidden", "should not land"))
        with pytest.raises(WebSocketDisconnect) as excinfo:
            ws.receive_bytes()
        assert excinfo.value.code == 4403

    assert block_content(db_session, "blk-forbidden") is None


def wait_until(condition, timeout=3.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(0.05)
    return condition()


def test_open_sockets_do_not_hold_database_connections(client, owner):
    from db.database import engine

    _, token = owner
    doc_id = create_doc(client, token)

    with connect(client, doc_id, token) as a, connect(client, doc_id, token) as b, connect(client, doc_id, token) as c:
        for ws in (a, b, c):
            ws.receive_bytes()
        a.send_bytes(new_block_update("blk-pool", "checked out?"))
        b.receive_bytes()
        c.receive_bytes()

        assert wait_until(lambda: engine.pool.checkedout() == 0), (
            f"{engine.pool.checkedout()} connections still checked out with idle sockets open"
        )


@pytest.fixture()
def fast_permission_recheck(monkeypatch):
    from db.modules.liveshare import routes

    monkeypatch.setattr(routes, "PERMISSION_RECHECK_SECONDS", 0.2)


def test_revoking_a_share_disconnects_the_open_socket(client, owner, other, fast_permission_recheck):
    _, owner_token = owner
    other_id, other_token = other
    doc_id = create_doc(client, owner_token)
    share(client, owner_token, doc_id, other_id, "write")

    with connect(client, doc_id, other_token) as ws:
        ws.receive_bytes()

        resp = client.request(
            "DELETE",
            "/doc-share",
            json={"doc_id": doc_id, "user_id": other_id},
            headers=auth(owner_token),
        )
        assert resp.json()["success"] is True

        with pytest.raises(WebSocketDisconnect) as excinfo:
            ws.receive_bytes()
        assert excinfo.value.code == 4401


def test_downgrading_write_to_read_stops_further_edits(client, owner, other, db_session, fast_permission_recheck):
    _, owner_token = owner
    other_id, other_token = other
    doc_id = create_doc(client, owner_token)
    share(client, owner_token, doc_id, other_id, "write")

    with connect(client, doc_id, other_token) as ws:
        ws.receive_bytes()

        share(client, owner_token, doc_id, other_id, "read")
        time.sleep(0.8)

        ws.send_bytes(new_block_update("blk-after-downgrade", "should not land"))
        with pytest.raises(WebSocketDisconnect) as excinfo:
            ws.receive_bytes()
        assert excinfo.value.code == 4403

    assert block_content(db_session, "blk-after-downgrade") is None


def test_flush_all_persists_rooms_that_are_still_open(client, owner, db_session):
    import asyncio

    from db.modules.liveshare.ydoc_room import registry

    _, token = owner
    doc_id = create_doc(client, token)

    async def scenario():
        room = await registry.get_or_create(doc_id)
        pycrdt.handle_sync_message(new_block_update("blk-shutdown", "kept at shutdown")[1:], room.ydoc)
        await registry.shutdown()

    try:
        asyncio.run(scenario())
    finally:
        registry.rooms.pop(doc_id, None)

    assert block_content(db_session, "blk-shutdown") == "kept at shutdown"
