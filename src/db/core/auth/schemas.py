from datetime import datetime

from pydantic import BaseModel, EmailStr
from typing import Optional

# ---------- Create ----------

class AuthUserCreate(BaseModel):
    username: Optional[str] = None          # may be auto-generated for OAuth
    email: str
    password: Optional[str] = None          # only for password-based accounts
    google_id: Optional[str] = None         # only for Google OAuth

class AuthUserCreate__Password(BaseModel):
    username: str
    email: str
    password: str

class AuthUserCreate__PasswordHash(BaseModel):
    username: str
    email: str
    password_hash: str

class AuthUserResponse(BaseModel):
    id: int
    username: str
    email: str
    google_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- Update ----------

class AuthUserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None

class AuthUserUpdate__Username(BaseModel):
    id: int
    username: str

class AuthUserUpdate__Email(BaseModel):
    id: int
    email: EmailStr

class AuthUserUpdate__Password(BaseModel):
    id: int
    password: str

class AuthUserUpdate__PasswordHash(BaseModel):
    id: int
    password_hash: str



# ---------- Login ----------

class AuthUserLogin__UsernamePassword(BaseModel):
    username: str
    password: str