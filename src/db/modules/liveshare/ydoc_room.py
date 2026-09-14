import asyncio
import time

import pycrdt
from fastapi import WebSocket
from sqlalchemy.orm import Session

from db.database import SessionLocal
from db.modules.liveshare.backfill import create_version_snapshot, flush_ydoc, load_or_create_ydoc

DEBOUNCE_SECONDS = 2
MAX_INTERVAL_SECONDS = 5

SNAPSHOT_INTERVAL_SECONDS = 10 * 60

MIN_SNAPSHOT_GAP_SECONDS = 30


class YRoom:
    """Owns the canonical Y.Doc + Awareness for one document, and the set of connected sockets.

    Incoming sync messages are applied to `self.ydoc` before being relayed to other sockets.
    """

    def __init__(self, doc_id: int, ydoc: pycrdt.Doc):
        self.doc_id = doc_id
        self.ydoc = ydoc
        self.awareness = pycrdt.Awareness(ydoc)
        self.sockets: set[WebSocket] = set()
        self.socket_client_ids: dict[WebSocket, set[int]] = {}

        self._save_task: asyncio.Task | None = None
        self._last_save_time: float = 0.0
        self._last_snapshot_time: float = 0.0

        self.awareness.observe(self._on_awareness_change)


    async def add_socket(self, websocket: WebSocket) -> None:
        self.sockets.add(websocket)

        await websocket.send_bytes(pycrdt.create_sync_message(self.ydoc))



        existing_ids = [
            cid for cid in self.awareness.states.keys() if cid != self.ydoc.client_id
        ]
        if existing_ids:
            update = self.awareness.encode_awareness_update(existing_ids)
            await websocket.send_bytes(pycrdt.create_awareness_message(update))

    def remove_socket(self, websocket: WebSocket) -> set[int]:
        """Detach a socket, returning any awareness client ids it owned."""
        self.sockets.discard(websocket)
        return self.socket_client_ids.pop(websocket, set())

    def forget_clients(self, client_ids: set[int], origin: WebSocket) -> None:
        if client_ids:
            self.awareness.remove_awareness_states(list(client_ids), origin=origin)


    async def handle_sync(self, raw_message: bytes, sender: WebSocket) -> None:
        inner = raw_message[1:]
        reply = pycrdt.handle_sync_message(inner, self.ydoc)
        if reply is not None:

            await sender.send_bytes(reply)
            return


        await self.broadcast(raw_message, sender)
        self.touch_save_timer()
        self.maybe_flush_on_interval()

    async def handle_awareness(self, raw_message: bytes, sender: WebSocket) -> None:
        inner = pycrdt.read_message(raw_message[1:])
        self.awareness.apply_awareness_update(inner, origin=sender)


    def _on_awareness_change(self, topic: str, payload) -> None:
        if topic != "update":
            return
        changes, origin = payload
        changed_ids = changes["added"] + changes["updated"] + changes["removed"]
        if not changed_ids:
            return

        if isinstance(origin, WebSocket):
            ids = self.socket_client_ids.setdefault(origin, set())
            ids.update(changes["added"] + changes["updated"])
            for cid in changes["removed"]:
                ids.discard(cid)

        message = pycrdt.create_awareness_message(
            self.awareness.encode_awareness_update(changed_ids)
        )
        sender = origin if isinstance(origin, WebSocket) else None
        asyncio.create_task(self.broadcast(message, sender))

    async def broadcast(self, message: bytes, sender: WebSocket | None) -> None:
        dead = []
        for ws in list(self.sockets):
            if ws is sender:
                continue
            try:
                await ws.send_bytes(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.sockets.discard(ws)
            self.socket_client_ids.pop(ws, None)


    def touch_save_timer(self) -> None:
        if self._save_task is not None:
            self._save_task.cancel()
        self._save_task = asyncio.create_task(self._debounce_save())

    async def _debounce_save(self) -> None:
        try:
            await asyncio.sleep(DEBOUNCE_SECONDS)
        except asyncio.CancelledError:
            return
        self.flush()

    def cancel_pending_save(self) -> None:
        if self._save_task is not None:
            self._save_task.cancel()
            self._save_task = None

    def flush(self, snapshot: bool = False) -> None:
        db = SessionLocal()
        try:
            flush_ydoc(self.doc_id, self.ydoc, db)
            now = time.time()
            self._last_save_time = now

            if snapshot and now - self._last_snapshot_time > MIN_SNAPSHOT_GAP_SECONDS:
                create_version_snapshot(self.doc_id, self.ydoc, db)
                self._last_snapshot_time = now
        finally:
            db.close()

    def maybe_flush_on_interval(self) -> None:
        now = time.time()
        if now - self._last_save_time > MAX_INTERVAL_SECONDS:
            due_for_snapshot = now - self._last_snapshot_time > SNAPSHOT_INTERVAL_SECONDS
            self.flush(snapshot=due_for_snapshot)


class RoomRegistry:
    def __init__(self):
        self.rooms: dict[int, YRoom] = {}
        self._locks: dict[int, asyncio.Lock] = {}

    def _lock_for(self, doc_id: int) -> asyncio.Lock:
        return self._locks.setdefault(doc_id, asyncio.Lock())

    async def get_or_create(self, doc_id: int, db: Session) -> YRoom:
        async with self._lock_for(doc_id):
            room = self.rooms.get(doc_id)
            if room is None:
                ydoc = load_or_create_ydoc(doc_id, db)
                room = YRoom(doc_id, ydoc)
                self.rooms[doc_id] = room
            return room

    async def drop_socket(self, doc_id: int, websocket: WebSocket) -> None:

        async with self._lock_for(doc_id):
            room = self.rooms.get(doc_id)
            if room is None:
                return
            client_ids = room.remove_socket(websocket)
            room.forget_clients(client_ids, origin=websocket)

            if not room.sockets:
                room.cancel_pending_save()

                room.flush(snapshot=True)
                del self.rooms[doc_id]

    def flush_all(self) -> None:
        """Called from the FastAPI lifespan shutdown hook."""
        for room in self.rooms.values():
            room.cancel_pending_save()
            room.flush(snapshot=True)


registry = RoomRegistry()
