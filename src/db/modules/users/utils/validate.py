from pydantic import TypeAdapter, EmailStr
from fastapi import HTTPException

email_adapter = TypeAdapter(EmailStr)

def validate_email(email: str) -> EmailStr:
    try:
        return email_adapter.validate_python(email)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid email")