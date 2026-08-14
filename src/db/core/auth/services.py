
from typing import Any

from sqlalchemy.orm import Session
from db.core.auth.crud import create_user__password, get_authuser_by_username, get_authuser_by_email, update_user__password_hash
from db.core.auth.utils.password import hash_password, verify_password
from db.core.auth.utils.token import create_access_token
from db.database import get_db
from db.core.auth.models import AuthUser
from db.core.auth.schemas import AuthUserCreate, AuthUserCreate__Password, AuthUserCreate__PasswordHash, AuthUserLogin__UsernamePassword, AuthUserUpdate, AuthUserUpdate__Email, AuthUserUpdate__Password, AuthUserUpdate__PasswordHash
from fastapi import Depends, HTTPException, Header, status

from db.core.auth.utils.token import verify_access_token
from db.modules.users.utils.validate import validate_email

#
def create_authuser(
        data: AuthUserCreate__Password,
        db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Creates a new user. Does NOT parse to check if data is valid.

    Supports:
      - Password-based login
      - TODO: OAuth login (Google)
    Returns:
      dict:
        - code (int): Indicates if the user was created successfully
        - user (AuthUser, optional): AuthUser db object if successful
        - token (str, optional): Authorization bearer token if successful

    Code:
      - 100 = success
      - 0 = error
      - 10 = invalid username
      - 20 = invalid email
      - 30 = invalid password
      - 90 = account already exists (email duplicate from google_id?)
    """
    # validate email to EmailStr
    try:
        validate_email(data.email)
    except HTTPException:
        return {
            "code": 20
        }
    
    # Check if a user already exists by username/email
    if get_authuser_by_username(data.username, db):
        return {
            "code": 10
        }
    if get_authuser_by_email(data.email, db):
        return {
            "code": 20
        }
    
    # Check password validity (TODO: just non-empty str rn)
    if data.password == "":
        return {
            "code": 30
        }

    # Create user
    user = create_user__password(AuthUserCreate__PasswordHash.model_validate({
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password)
    }), db)

    # No access token is minted here: get_current_user() always resolves a
    # token's `sub` against users.id, not auth_users.id, and the caller
    # (create_user__password in users/services.py) is the one that knows the
    # resulting users.id once the paired User row is created.
    return {
        "code": 100,
        "user": user,
    }

def login_authuser__username_password(
        data: AuthUserLogin__UsernamePassword,
        db: Session = Depends(get_db),
) -> str | None:
    """
    Logs in a new user using username/password.
    
    Returns:
        access token (str) if successful else None
    """
    user = get_authuser_by_username(data.username, db)
    if user is None:
        return None
    
    if verify_password(data.password, user.password_hash):
        return create_access_token(user.id)
    return

def update_authuser__password(
        data: AuthUserUpdate__Password,
        db: Session = Depends(get_db),
):
    """
    Updates user's password if user's id exists.

    Returns:
        boolean, whether update succeeded or not
    """
    return update_user__password_hash(AuthUserUpdate__PasswordHash.model_validate({
        "id": data.id,
        "password_hash": hash_password(data.password)
    }), db)
