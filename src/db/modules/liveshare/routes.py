import asyncio

import pycrdt
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from sqlalchemy.orm import Session

from db.database import SessionLocal, get_db
from db.modules.docs.services import user_can_read_document, user_can_write_document
from db.modules.liveshare.ydoc_room import YRoom, registry as yroom_registry
from db.modules.users.services import get_current_user_ws

router = APIRouter()

# How often an already-connected socket's read access is re-verified, so a
# revoked share kicks the socket instead of only being enforced at connect
# time (write access is re-verified on every message instead - see below).
READ_PERMISSION_RECHECK_SECONDS = 15


@router.websocket("/ws/docs/{doc_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    doc_id: int,

    db: Session = Depends(get_db),
    current_user_id: int|None = Depends(get_current_user_ws),
) -> None:
    if not current_user_id or not user_can_read_document(doc_id, current_user_id, db):
        # hard rejection - the old path silently returned None/skipped broadcast
        # instead of ever closing the handshake, leaving the sender's optimistic
        # local edits diverged from the server with no signal
        await websocket.close(code=4401)
        return

    await websocket.accept()
    room = await yroom_registry.get_or_create(doc_id, db)
    await room.add_socket(websocket)

    recheck_task = asyncio.create_task(
        _watch_read_permission(websocket, doc_id, current_user_id)
    )

    try:
        while True:
            message = await websocket.receive_bytes()
            try:
                # re-checked per message (not cached at connect) so a
                # collaborator's write access being revoked mid-session takes
                # effect on their very next edit instead of only at reconnect
                can_write = user_can_write_document(doc_id, current_user_id, db)
                await _handle_message(room, message, websocket, can_write)
            except PermissionError:
                await websocket.close(code=4403)
                return
            except Exception as e:
                # a malformed/corrupt frame must not kill the connection - the
                # old JSON path let an uncaught exception here escape the loop
                # entirely, leaving a zombie socket that broke future broadcasts
                print(f"liveshare: dropping bad message for doc {doc_id}: {e}")

    except (WebSocketDisconnect, RuntimeError):
        pass

    finally:
        recheck_task.cancel()
        await yroom_registry.drop_socket(doc_id, websocket)


async def _watch_read_permission(websocket: WebSocket, doc_id: int, user_id: int) -> None:
    """Periodically re-verifies read access on an already-open socket, so a
    revoked/deleted share closes the connection instead of leaving it able
    to keep receiving updates until the client happens to reconnect.

    Uses its own DB session rather than the request-scoped one, since it
    runs concurrently with the main receive loop and SQLAlchemy sessions
    aren't safe for concurrent use from multiple coroutines.
    """
    try:
        while True:
            await asyncio.sleep(READ_PERMISSION_RECHECK_SECONDS)
            db = SessionLocal()
            try:
                allowed = user_can_read_document(doc_id, user_id, db)
            finally:
                db.close()
            if not allowed:
                await websocket.close(code=4401)
                return
    except asyncio.CancelledError:
        return


async def _handle_message(room: YRoom, message: bytes, sender: WebSocket, can_write: bool) -> None:
    if len(message) < 2:
        return
    msg_type = message[0]

    if msg_type == pycrdt.YMessageType.SYNC:
        sync_type = message[1]
        if not can_write and sync_type in (
            pycrdt.YSyncMessageType.SYNC_STEP2,
            pycrdt.YSyncMessageType.SYNC_UPDATE,
        ):
            raise PermissionError("read-only user attempted to write")
        await room.handle_sync(message, sender)

    elif msg_type == pycrdt.YMessageType.AWARENESS:
        await room.handle_awareness(message, sender)
