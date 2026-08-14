from db.core.auth.models import AuthUser
from db.core.auth.schemas import AuthUserCreate__Password
from db.database import get_db
from db.modules.users.models import User
from db.modules.users.schemas import UserCreate__AuthUser
from fastapi import Depends
from sqlalchemy.orm import Session


def create_user__authuser(
        data: UserCreate__AuthUser,
        db: Session = Depends(get_db),
):
    obj = User(authuser_id=data.authuser_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_user_by_id(id: int, db: Session) -> User | None:
    return db.query(User).filter(User.id == id).first()

def get_user_by_username(username: str, db: Session) -> User | None:
    return db.query(User).join(User.authuser).filter(AuthUser.username == username).first()

def get_user_by_email(email: str, db: Session) -> User | None:
    return db.query(User).join(User.authuser).filter(AuthUser.email == email).first()