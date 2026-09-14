from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt

import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "")
assert SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 300

def create_access_token(user_id: int, token_version: int = 0) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "ver": token_version, "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def verify_access_token(token: str) -> Optional[tuple[int, int]]:
    """Returns (user_id, token_version) from a valid, unexpired token, or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        # Tokens minted before "ver" existed have no claim - treat as version 0.
        ver = payload.get("ver", 0)
        return int(sub), int(ver)
    except (JWTError, TypeError, ValueError):
        return None