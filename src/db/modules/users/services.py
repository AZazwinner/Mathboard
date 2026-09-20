

from db.core.auth.schemas import AuthUserCreate__Password
from db.core.auth.services import create_authuser
from db.core.auth.utils.password import hash_password, verify_password
from db.core.auth.utils.token import create_access_token, verify_access_token, verify_ws_credential
from db.database import get_db, run_in_db
from fastapi import Depends, HTTPException, Header, WebSocket
from sqlalchemy.orm import Session

from db.modules.users.crud import create_user__authuser, get_user_by_email, get_user_by_username
from db.modules.users.models import User
from db.modules.users.schemas import UserCreate__AuthUser, UserPrivateResponse, UserPublicResponse, UserSignin

def create_user__password(
        data: AuthUserCreate__Password,
        db: Session = Depends(get_db),
):
    """Creates a new user. Does NOT validate data itself.

    Codes: 100 = success, 0 = error, 10 = invalid username, 20 = invalid email,
    30 = invalid password, 90 = account already exists.
    """
    authuser_create_dict = create_authuser(data, db)
    if authuser_create_dict["code"] == 100:
        authuser_arg = UserCreate__AuthUser.model_validate({
            "authuser_id": authuser_create_dict["user"].id,
            "username": authuser_create_dict["user"].username,
            "email": authuser_create_dict["user"].email,
        })
        user = create_user__authuser(authuser_arg, db)
        return {
            "code": 100,
            "user": user,

            "token": create_access_token(user.id, user.token_version)
        }
    else:
        return {
            "code": authuser_create_dict["code"]
        }
    
def login_user__password(
        data: UserSignin,
        db: Session
) -> User | None:
    user = get_user_by_username(data.username, db)
    if user is None:
        user = get_user_by_email(data.username, db)
        
    if user is None:
        return

    if user.authuser.password_hash is None:
        return
    elif verify_password(data.password, user.authuser.password_hash):
        return user
    else:
        return
    
def get_user_public(db: Session, user_id: int) -> UserPublicResponse:
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return UserPublicResponse.model_validate(user)

def get_user_private(db: Session, user_id: int) -> UserPrivateResponse:
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return UserPrivateResponse.model_validate(user)

def get_current_user(
        authorization: str = Header(...),
    db: Session = Depends(get_db)
) -> UserPrivateResponse:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth scheme")
    token = authorization[7:]
    result = verify_access_token(token)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id, token_version = result

    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.token_version != token_version:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user

def _current_token_version(user_id: int, db: Session) -> int | None:
    user = db.get(User, user_id)
    return user.token_version if user else None

async def get_current_user_ws(websocket: WebSocket) -> int|None:
    token = websocket.query_params.get("token")

    if not token:
        return None

    result = verify_ws_credential(token)
    if not result:
        return None
    user_id, token_version = result

    current_version = await run_in_db(_current_token_version, user_id)
    if current_version is None or current_version != token_version:
        return None

    return user_id
