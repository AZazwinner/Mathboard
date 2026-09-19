import asyncio
from dataclasses import dataclass

import pycrdt
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from sqlalchemy.orm import Session

from db.database import run_in_db
from db.modules.docs.services import user_can_read_document, user_can_write_document
from db.modules.liveshare.ydoc_room import YRoom, registry as yroom_registry
from db.modules.users.services import get_current_user_ws

router = APIRouter()


PERMISSION_RECHECK_SECONDS = 5


@dataclass
class SocketAccess:
    can_write: bool


def _load_access(doc_id: int, user_id: int, db: Session) -> tuple[bool, bool]:
    can_read = user_can_read_document(doc_id, user_id, db)
    can_write = can_read and user_can_write_document(doc_id, user_id, db)
    return can_read, can_write


@router.websocket("/ws/docs/{doc_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    doc_id: int,
    current_user_id: int|None = Depends(get_current_user_ws),
) -> None:
    if not current_user_id:
        await websocket.close(code=4401)
        return

    can_read, can_write = await run_in_db(_load_access, doc_id, current_user_id)
    if not can_read:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    room = await yroom_registry.get_or_create(doc_id)
    await room.add_socket(websocket)

    access = SocketAccess(can_write=can_write)
    recheck_task = asyncio.create_task(
        _watch_permissions(websocket, doc_id, current_user_id, access)
    )

    try:
        while True:
            message = await websocket.receive_bytes()
            try:
                await _handle_message(room, message, websocket, access.can_write)
            except PermissionError:
                await websocket.close(code=4403)
                return
            except Exception as e:

                print(f"liveshare: dropping bad message for doc {doc_id}: {e}")

    except (WebSocketDisconnect, RuntimeError):
        pass

    finally:
        recheck_task.cancel()
        await yroom_registry.drop_socket(doc_id, websocket)


async def _watch_permissions(
    websocket: WebSocket, doc_id: int, user_id: int, access: SocketAccess
) -> None:
    """Periodically re-verifies access, closing the socket if a share is revoked and keeping `access.can_write` current so the receive loop never has to query the DB per message."""
    try:
        while True:
            await asyncio.sleep(PERMISSION_RECHECK_SECONDS)
            try:
                can_read, can_write = await run_in_db(_load_access, doc_id, user_id)
            except Exception as e:
                print(f"liveshare: permission recheck failed for doc {doc_id}: {e}")
                continue
            if not can_read:
                await websocket.close(code=4401)
                return
            access.can_write = can_write
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
