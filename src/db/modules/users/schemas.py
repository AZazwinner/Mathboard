from typing import Literal, Optional

from pydantic import BaseModel

from db.core.auth.schemas import AuthUserResponse

# ---------- Create ----------
class UserCreate__AuthUser(BaseModel):
    authuser_id: int
    username: str
    email: str

# ---------- Get ----------
class UserPublicResponse(BaseModel):
    id: int
    username: Optional[str] = None

    class Config:
        from_attributes = True

class UserPrivateResponse(UserPublicResponse):
    authuser_id: int
    authuser: "AuthUserResponse"
    email: Optional[str] = None

    class Config:
        from_attributes = True

class CreateUserResponse(BaseModel):
    code: int
    user: Optional[UserPrivateResponse] = None
    token: Optional[str] = None

# ---------- Update ----------
class UserUpdate__Username(BaseModel):
    id: int
    username: str

class UserUpdate__Email(BaseModel):
    id: int
    username: str

class UserUpdate__Password(BaseModel):
    id: int
    username: str

# ---------- Signin -----------
class UserSignin(BaseModel):
    username: str # can be email
    password: str

class UserSigninResponse(BaseModel):
    user: UserPrivateResponse | None
    token: Optional[str] = None

    class Config:
        from_attributes = True
