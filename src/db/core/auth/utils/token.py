from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt

import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "")
assert SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
WS_TICKET_EXPIRE_SECONDS = 60
WS_AUDIENCE = "ws"

def create_access_token(user_id: int, token_version: int = 0) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "ver": token_version, "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def create_ws_ticket(user_id: int, token_version: int) -> str:
    """A one-minute token that is only good for opening a WebSocket. Browsers can't set headers on a WebSocket, so the credential travels in the URL and lands in access logs; a ticket that has expired by the time anyone reads the log is harmless where the login token is not. The `aud` claim also stops it being used as a login token."""
    expire = datetime.utcnow() + timedelta(seconds=WS_TICKET_EXPIRE_SECONDS)
    payload = {"sub": str(user_id), "ver": token_version, "exp": expire, "aud": WS_AUDIENCE}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_access_token(token: str) -> Optional[tuple[int, int]]:
    """Returns (user_id, token_version) from a valid, unexpired token, or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None

        ver = payload.get("ver", 0)
        return int(sub), int(ver)
    except (JWTError, TypeError, ValueError):
        return None

def _accepts_login_token_on_websocket() -> bool:
    """Until every browser has the frontend that asks for tickets, sockets opened with the login token keep working. Set WS_ACCEPT_LOGIN_TOKEN=0 once that's true, so a token found in a log can't open a socket."""
    return os.getenv("WS_ACCEPT_LOGIN_TOKEN", "1").strip().lower() not in {"0", "false", "no"}

def verify_ws_credential(token: str) -> Optional[tuple[int, int]]:
    """Returns (user_id, token_version) for a WebSocket ticket, or for a login token while those are still accepted."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience=WS_AUDIENCE)
        if "aud" not in payload and not _accepts_login_token_on_websocket():
            return None
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub), int(payload.get("ver", 0))
    except (JWTError, TypeError, ValueError):
        return None