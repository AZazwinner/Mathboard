
import secrets
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session
from db.core.auth.crud import create_password_reset_token, create_user__password, get_authuser_by_username, get_authuser_by_email, get_password_reset_token, mark_password_reset_token_used, update_user__password_hash
from db.core.auth.utils.password import hash_password, verify_password
from db.core.auth.utils.token import create_access_token
from db.database import get_db
from db.core.auth.models import AuthUser
from db.core.auth.schemas import AuthUserCreate, AuthUserCreate__Password, AuthUserCreate__PasswordHash, AuthUserLogin__UsernamePassword, AuthUserUpdate, AuthUserUpdate__Email, AuthUserUpdate__Password, AuthUserUpdate__PasswordHash
from fastapi import Depends, HTTPException, Header, status

from db.core.auth.utils.token import verify_access_token
from db.modules.users.crud import bump_token_version, get_user_by_authuser_id
from db.modules.users.utils.validate import is_valid_password, validate_email, validate_password

def create_authuser(
        data: AuthUserCreate__Password,
        db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Creates a user; returns dict with `code` (100=success, 0=error, 10=bad username, 20=bad email, 30=bad password, 90=already exists) and `user` on success."""
    try:
        validate_email(data.email)
    except HTTPException:
        return {
            "code": 20
        }

    if get_authuser_by_username(data.username, db):
        return {
            "code": 10
        }
    if get_authuser_by_email(data.email, db):
        return {
            "code": 20
        }

    if not is_valid_password(data.password):
        return {
            "code": 30
        }

    user = create_user__password(AuthUserCreate__PasswordHash.model_validate({
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password)
    }), db)

    # No token minted here: tokens' `sub` maps to users.id, not auth_users.id, which the caller resolves once it creates the paired User row.
    return {
        "code": 100,
        "user": user,
    }

def login_authuser__username_password(
        data: AuthUserLogin__UsernamePassword,
        db: Session = Depends(get_db),
) -> str | None:
    """Logs in with username/password; returns an access token, or None on failure."""
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
    """Updates the user's password hash; returns whether it succeeded."""
    validate_password(data.password)
    success = update_user__password_hash(AuthUserUpdate__PasswordHash.model_validate({
        "id": data.id,
        "password_hash": hash_password(data.password)
    }), db)
    if success:
        # data.id is auth_users.id here; find the paired users.id to invalidate its tokens.
        user_row = get_user_by_authuser_id(data.id, db)
        if user_row is not None:
            bump_token_version(user_row.id, db)
    return success


RESET_TOKEN_TTL_MINUTES = 30

def request_password_reset(
        email: str,
        db: Session,
) -> str | None:
    """Issues a one-time reset token for `email`, or None if no account matches; callers should report success either way to avoid email enumeration."""
    user = get_authuser_by_email(email, db)
    if user is None:
        return None

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
    create_password_reset_token(user.id, token, expires_at, db)
    return token

def reset_password_with_token(
        token: str,
        new_password: str,
        db: Session,
) -> bool:
    """Consumes a single-use reset token and sets the new password; returns False if unknown, used, or expired."""
    record = get_password_reset_token(token, db)
    if record is None or record.used or record.expires_at < datetime.utcnow():
        return False

    validate_password(new_password)

    update_user__password_hash(AuthUserUpdate__PasswordHash.model_validate({
        "id": record.authuser_id,
        "password_hash": hash_password(new_password),
    }), db)
    mark_password_reset_token_used(record, db)

    user_row = get_user_by_authuser_id(record.authuser_id, db)
    if user_row is not None:
        bump_token_version(user_row.id, db)
    return True
