from pydantic import TypeAdapter, EmailStr
from fastapi import HTTPException

email_adapter = TypeAdapter(EmailStr)

def validate_email(email: str) -> EmailStr:
    try:
        return email_adapter.validate_python(email)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid email")

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
MAX_USERNAME_LENGTH = 64

def is_valid_password(password: str) -> bool:
    return MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH

def is_valid_username(username: str) -> bool:
    return bool(username.strip()) and len(username) <= MAX_USERNAME_LENGTH

def validate_password(password: str) -> None:
    if not is_valid_password(password):
        raise HTTPException(
            status_code=400,
            detail=f"Password must be {MIN_PASSWORD_LENGTH} to {MAX_PASSWORD_LENGTH} characters",
        )
