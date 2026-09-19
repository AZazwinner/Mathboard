import asyncio
import os
import threading

import pycrdt
import pytest

from db.coordination import is_document_live_elsewhere
from db.modules.docs.models import Document, DocumentBlock, DocumentYDoc
from db.modules.liveshare import ydoc_room
from db.modules.liveshare.backfill import BLOCKS_KEY, ydoc_blocks
from db.modules.liveshare.ydoc_room import RoomRegistry
from tests.conftest import IS_POSTGRES
from tests.test_docs_permissions import create_doc, signup
from tests.test_liveshare_ws import new_block_update

VALKEY_URL = os.getenv("TEST_VALKEY_URL")
needs_valkey = pytest.mark.skipif(not VALKEY_URL, reason="TEST_VALKEY_URL not set")
needs_postgres = pytest.mark.skipif(not IS_POSTGRES, reason="needs Postgres advisory locks")
DEAD_VALKEY = "redis://127.0.0.1:1/0"


class FakeSocket:
    def __init__(self):
        self.sent: list[bytes] = []

    async def send_bytes(self, data: bytes) -> None:
        self.sent.append(data)


def block_ids(ydoc) -> list[str]:
    return [b["id"] for b in ydoc_blocks(ydoc)]


def blocks_seen_by(socket: FakeSocket) -> set[str]:
    replica = pycrdt.Doc()
    for message in socket.sent:
        if message[0] == pycrdt.YMessageType.SYNC:
            pycrdt.handle_sync_message(message[1:], replica)
    return {b["id"] for b in replica.get(BLOCKS_KEY, type=pycrdt.Array).to_py()}


def awareness_messages(socket: FakeSocket) -> list[bytes]:
    return [m for m in socket.sent if m[0] == pycrdt.YMessageType.AWARENESS]


async def wait_until(condition, timeout=6.0):
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if condition():
            return True
        await asyncio.sleep(0.05)
    return condition()


async def shutdown_all(*registries):
    for registry in registries:
        await registry.shutdown()


@pytest.fixture()
def doc_id(client):
    _, token = signup(client, "owner", "owner@example.com")
    return create_doc(client, token)


@pytest.fixture(autouse=True)
def manual_flushes(monkeypatch):
    """Keep flushes and reconciles under each test's control so results don't depend on timers."""
    monkeypatch.setattr(ydoc_room, "DEBOUNCE_SECONDS", 3600)
    monkeypatch.setattr(ydoc_room, "MAX_INTERVAL_SECONDS", 3600)
    monkeypatch.setattr(ydoc_room, "RECONCILE_SECONDS", 0)
    monkeypatch.setattr(ydoc_room.YRoom, "maybe_flush_on_interval", lambda self: None)


@needs_valkey
def test_an_edit_on_one_replica_reaches_a_socket_on_another(doc_id):
    async def scenario():
        a, b = RoomRegistry(VALKEY_URL), RoomRegistry(VALKEY_URL)
        try:
            room_a, room_b = await a.get_or_create(doc_id), await b.get_or_create(doc_id)
            sock_a, sock_b = FakeSocket(), FakeSocket()
            await room_a.add_socket(sock_a)
            await room_b.add_socket(sock_b)

            await room_a.handle_sync(new_block_update("from-a", "hello"), sock_a)

            assert await wait_until(lambda: "from-a" in blocks_seen_by(sock_b))
            assert "from-a" in block_ids(room_b.ydoc)
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


@needs_valkey
def test_concurrent_edits_on_two_replicas_converge(doc_id):
    async def scenario():
        a, b = RoomRegistry(VALKEY_URL), RoomRegistry(VALKEY_URL)
        try:
            room_a, room_b = await a.get_or_create(doc_id), await b.get_or_create(doc_id)
            sock_a, sock_b = FakeSocket(), FakeSocket()
            await room_a.add_socket(sock_a)
            await room_b.add_socket(sock_b)

            await asyncio.gather(
                room_a.handle_sync(new_block_update("only-a", "a"), sock_a),
                room_b.handle_sync(new_block_update("only-b", "b"), sock_b),
            )

            both = {"only-a", "only-b"}
            assert await wait_until(lambda: both <= set(block_ids(room_a.ydoc)) and both <= set(block_ids(room_b.ydoc)))
            assert block_ids(room_a.ydoc) == block_ids(room_b.ydoc)
            assert await wait_until(lambda: "only-b" in blocks_seen_by(sock_a) and "only-a" in blocks_seen_by(sock_b))
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


@needs_valkey
def test_updates_are_not_echoed_between_replicas(doc_id):
    async def scenario():
        a, b = RoomRegistry(VALKEY_URL), RoomRegistry(VALKEY_URL)
        try:
            room_a, room_b = await a.get_or_create(doc_id), await b.get_or_create(doc_id)
            sock_a, sock_b = FakeSocket(), FakeSocket()
            await room_a.add_socket(sock_a)
            await room_b.add_socket(sock_b)

            await room_a.handle_sync(new_block_update("once", "x"), sock_a)
            assert await wait_until(lambda: "once" in blocks_seen_by(sock_b))
            await asyncio.sleep(1.0)

            assert len(sock_a.sent) == 1
            assert len(sock_b.sent) == 2
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


@needs_valkey
def test_a_replica_that_joins_late_replays_updates_the_database_lacks(doc_id, db_session):
    async def scenario():
        a, c = RoomRegistry(VALKEY_URL), RoomRegistry(VALKEY_URL)
        try:
            room_a = await a.get_or_create(doc_id)
            sock_a = FakeSocket()
            await room_a.add_socket(sock_a)

            await room_a.handle_sync(new_block_update("flushed", "in the database"), sock_a)
            await room_a.flush()
            await room_a.handle_sync(new_block_update("only-in-stream", "not flushed"), sock_a)
            assert await wait_until(lambda: room_a.applied_stream_id != "0-0")
            await asyncio.sleep(0.3)

            stored = pycrdt.Doc()
            stored.apply_update(db_session.get(DocumentYDoc, doc_id).state)
            assert "only-in-stream" not in block_ids(stored)

            room_c = await c.get_or_create(doc_id)
            assert await wait_until(lambda: {"flushed", "only-in-stream"} <= set(block_ids(room_c.ydoc)))
        finally:
            await shutdown_all(a, c)

    asyncio.run(scenario())


def test_flushing_merges_instead_of_overwriting(doc_id, db_session):
    """The original bug: with two replicas, whichever flushed last replaced the other's edits."""
    async def scenario():
        a, b = RoomRegistry(None), RoomRegistry(None)
        try:
            room_a, room_b = await a.get_or_create(doc_id), await b.get_or_create(doc_id)
            sock_a, sock_b = FakeSocket(), FakeSocket()
            await room_a.add_socket(sock_a)
            await room_b.add_socket(sock_b)

            await room_a.handle_sync(new_block_update("edit-a", "from a"), sock_a)
            await room_b.handle_sync(new_block_update("edit-b", "from b"), sock_b)

            await room_a.flush()
            await room_b.flush()

            stored = {row.id for row in db_session.query(DocumentBlock).filter(DocumentBlock.doc_id == doc_id)}
            assert {"edit-a", "edit-b"} <= stored

            await room_a.flush()
            assert "edit-b" in block_ids(room_a.ydoc)
            assert await wait_until(lambda: "edit-b" in blocks_seen_by(sock_a))
            assert block_ids(room_a.ydoc) == block_ids(room_b.ydoc)
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


def test_replicas_converge_through_the_database_when_valkey_is_absent(doc_id, monkeypatch):
    monkeypatch.setattr(ydoc_room, "RECONCILE_SECONDS", 0.2)

    async def scenario():
        a, b = RoomRegistry(None), RoomRegistry(None)
        try:
            room_a, room_b = await a.get_or_create(doc_id), await b.get_or_create(doc_id)
            sock_a, sock_b = FakeSocket(), FakeSocket()
            await room_a.add_socket(sock_a)
            await room_b.add_socket(sock_b)

            await room_a.handle_sync(new_block_update("via-db", "x"), sock_a)
            await room_a.flush()

            assert await wait_until(lambda: "via-db" in blocks_seen_by(sock_b))
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


def test_editing_still_works_when_valkey_is_down(doc_id, monkeypatch):
    monkeypatch.setattr(ydoc_room, "RECONCILE_SECONDS", 0.2)

    async def scenario():
        a, b = RoomRegistry(DEAD_VALKEY), RoomRegistry(DEAD_VALKEY)
        try:
            room_a, room_b = await a.get_or_create(doc_id), await b.get_or_create(doc_id)
            sock_a, sock_b = FakeSocket(), FakeSocket()
            await room_a.add_socket(sock_a)
            await room_b.add_socket(sock_b)

            await room_a.handle_sync(new_block_update("no-valkey", "still works"), sock_a)
            assert "no-valkey" in block_ids(room_a.ydoc)
            await room_a.flush()

            assert await wait_until(lambda: "no-valkey" in blocks_seen_by(sock_b))
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


@needs_valkey
def test_cursors_are_shared_across_replicas(doc_id):
    async def scenario():
        a, b = RoomRegistry(VALKEY_URL), RoomRegistry(VALKEY_URL)
        try:
            room_a, room_b = await a.get_or_create(doc_id), await b.get_or_create(doc_id)
            sock_a, sock_b = FakeSocket(), FakeSocket()
            await room_a.add_socket(sock_a)
            await room_b.add_socket(sock_b)
            assert await wait_until(lambda: room_a.bus._handlers and room_b.bus._handlers)
            await asyncio.sleep(0.3)

            client_awareness = pycrdt.Awareness(pycrdt.Doc())
            client_awareness.set_local_state({"user": {"name": "ada"}})
            update = client_awareness.encode_awareness_update([client_awareness.client_id])
            await room_a.handle_awareness(pycrdt.create_awareness_message(update), sock_a)

            assert await wait_until(lambda: len(awareness_messages(sock_b)) >= 1)
            assert client_awareness.client_id in room_b.awareness.states

            before = len(awareness_messages(sock_b))
            await a.drop_socket(doc_id, sock_a)
            assert await wait_until(lambda: len(awareness_messages(sock_b)) > before)
            assert client_awareness.client_id not in room_b.awareness.states
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


@needs_valkey
def test_a_replica_that_starts_later_learns_existing_cursors(doc_id):
    async def scenario():
        a, b = RoomRegistry(VALKEY_URL), RoomRegistry(VALKEY_URL)
        try:
            room_a = await a.get_or_create(doc_id)
            sock_a = FakeSocket()
            await room_a.add_socket(sock_a)
            await asyncio.sleep(0.3)

            client_awareness = pycrdt.Awareness(pycrdt.Doc())
            client_awareness.set_local_state({"user": {"name": "grace"}})
            update = client_awareness.encode_awareness_update([client_awareness.client_id])
            await room_a.handle_awareness(pycrdt.create_awareness_message(update), sock_a)

            room_b = await b.get_or_create(doc_id)
            assert await wait_until(lambda: client_awareness.client_id in room_b.awareness.states)
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


@needs_valkey
def test_a_document_open_on_any_replica_is_reported_live(doc_id):
    async def scenario():
        b = RoomRegistry(VALKEY_URL)
        try:
            assert is_document_live_elsewhere(doc_id) is False

            room = await b.get_or_create(doc_id)
            sock = FakeSocket()
            await room.add_socket(sock)
            assert await wait_until(lambda: is_document_live_elsewhere(doc_id))

            await b.drop_socket(doc_id, sock)
            assert is_document_live_elsewhere(doc_id) is False
        finally:
            await shutdown_all(b)

    asyncio.run(scenario())


def test_liveness_check_fails_closed_when_valkey_is_unreachable(monkeypatch):
    import db.coordination as coordination

    monkeypatch.setenv("VALKEY_URL", DEAD_VALKEY)
    monkeypatch.setattr(coordination, "_sync_client", None)
    assert is_document_live_elsewhere(1) is True
    monkeypatch.setattr(coordination, "_sync_client", None)


@needs_postgres
def test_two_replicas_opening_a_legacy_document_do_not_duplicate_its_blocks(client, db_session, monkeypatch):
    from db.modules.liveshare import backfill

    barrier = threading.Barrier(2, timeout=10)
    calls = []
    real_lock = backfill.lock_document

    def lock_after_both_replicas_saw_no_row(db, doc_id):
        calls.append(1)
        if len(calls) <= 2:
            barrier.wait()
        real_lock(db, doc_id)

    monkeypatch.setattr(backfill, "lock_document", lock_after_both_replicas_saw_no_row)

    _, token = signup(client, "legacy", "legacy@example.com")
    doc_id = create_doc(client, token)
    doc = db_session.get(Document, doc_id)
    db_session.query(DocumentYDoc).filter(DocumentYDoc.doc_id == doc_id).delete()
    db_session.query(DocumentBlock).filter(DocumentBlock.doc_id == doc_id).delete()
    for position, block_id in enumerate(["b1", "b2", "b3"]):
        db_session.add(DocumentBlock(id=block_id, doc_id=doc.id, position=position, type="paragraph", content=block_id))
    db_session.commit()

    async def scenario():
        a, b = RoomRegistry(None), RoomRegistry(None)
        try:
            room_a, room_b = await asyncio.gather(a.get_or_create(doc_id), b.get_or_create(doc_id))
            merged = pycrdt.Doc()
            merged.apply_update(room_a.ydoc.get_update())
            merged.apply_update(room_b.ydoc.get_update())
            assert block_ids(merged) == ["b1", "b2", "b3"]
        finally:
            await shutdown_all(a, b)

    asyncio.run(scenario())


@needs_valkey
def test_the_stream_position_is_saved_with_the_state(doc_id, db_session):
    async def scenario():
        a = RoomRegistry(VALKEY_URL)
        try:
            room = await a.get_or_create(doc_id)
            sock = FakeSocket()
            await room.add_socket(sock)
            await room.handle_sync(new_block_update("positioned", "x"), sock)
            assert await wait_until(lambda: room.applied_stream_id != "0-0")
            await room.flush()
            return room.applied_stream_id
        finally:
            await shutdown_all(a)

    applied = asyncio.run(scenario())
    db_session.expire_all()
    assert db_session.get(DocumentYDoc, doc_id).stream_id == applied
