from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.core.auth.schemas import AuthUserCreate__Password, AuthUserUpdate__Password
from db.core.auth.services import update_authuser__password
from db.core.auth.utils.token import create_access_token
from db.modules.users.crud import get_user_by_id, get_user_by_username
from db.modules.users.schemas import CreateUserResponse, UserPublicResponse, UserPrivateResponse, UserSignin, UserSigninResponse
from db.modules.users.services import create_user__password, get_current_user, login_user__password
from db.database import get_db

router = APIRouter()

@router.get("/ping")
def ping():
    return {"message": "pong"}

@router.post("/create-user", response_model=CreateUserResponse)
def create_user__password_route(
        data: AuthUserCreate__Password,
        db: Session = Depends(get_db),
):
    return create_user__password(data, db)

class GetUserResponse(BaseModel):
    success: bool
    user: Optional[UserPublicResponse]

@router.get("/user", response_model=GetUserResponse)
def get_user(
        id: int|None=None,
        username: str|None=None,
        current_user: UserPrivateResponse = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    if id is not None:
        user = get_user_by_id(id, db)
    elif username is not None:
        user = get_user_by_username(username, db)
    else:
        return {
            "success": False
        }
    
    if user is None:
        return {
            "success": False
        }
    else:
        return {
            "success": True,
            "user": user
        }

@router.get("/me", response_model=UserPrivateResponse)
def get_me(
        current_user: UserPrivateResponse = Depends(get_current_user)
):
    return current_user
    

class UpdatePasswordData(BaseModel):
    password: str
class UpdatePasswordResponse(BaseModel):
    success: bool

@router.post("/user-update-password", response_model=UpdatePasswordResponse)
def update_password(
        data: UpdatePasswordData,
        current_user: UserPrivateResponse = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    auth_services_data = AuthUserUpdate__Password.model_validate({
        "id": current_user.authuser_id,
        "password": data.password
    })
    success = update_authuser__password(auth_services_data, db)
    return {
        "success": success
    }


@router.post("/signin", response_model=UserSigninResponse)
def login_user(
    user_data: UserSignin,
    db: Session = Depends(get_db),
):
    """
    Logins a new user.

    Supports:
      - Either username or email in username slot
    Returns:
      - user (UserPrivateResponse or None)
      - token (str, optional) - Authorization Bearer token
    """
    user = login_user__password(user_data, db)
    if user is None:
        return {
            "user": None
        }

    access_token = create_access_token(user.id)
    return {
        "user": user,
        "token": access_token
    }