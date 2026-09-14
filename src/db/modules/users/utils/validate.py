from pydantic import TypeAdapter, EmailStr
from fastapi import HTTPException

email_adapter = TypeAdapter(EmailStr)

def validate_email(email: str) -> EmailStr:
    try:
        return email_adapter.validate_python(email)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid email")

MIN_PASSWORD_LENGTH = 8

def is_valid_password(password: str) -> bool:
    return len(password) >= MIN_PASSWORD_LENGTH

def validate_password(password: str) -> None:
    if not is_valid_password(password):
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters",
        )