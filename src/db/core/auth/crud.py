from sqlalchemy.orm import Session
from .schemas import AuthUserCreate__PasswordHash, AuthUserUpdate__Username, AuthUserUpdate__Email, AuthUserUpdate__PasswordHash
from .models import AuthUser

def create_user__password(data: AuthUserCreate__PasswordHash, db: Session) -> AuthUser:
    obj = AuthUser(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def get_authuser_by_id(id: int, db: Session) -> AuthUser | None:
    return db.query(AuthUser).filter(AuthUser.id == id).first()

def get_authuser_by_username(username: str, db: Session) -> AuthUser | None:
    return db.query(AuthUser).filter(AuthUser.username == username).first()

def get_authuser_by_email(email: str, db: Session) -> AuthUser | None:
    return db.query(AuthUser).filter(AuthUser.email == email).first()

def update_user__username(data: AuthUserUpdate__Username, db: Session) -> bool:
    user = get_authuser_by_id(data.id, db)
    if user is None:
        return False
    
    user.username = data.username
    db.commit()
    db.refresh(user)
    return True
    
def update_user__email(data: AuthUserUpdate__Email, db: Session) -> bool:
    user = get_authuser_by_id(data.id, db)
    if user is None:
        return False
    
    user.email = data.email
    db.commit()
    db.refresh(user)
    return True

def update_user__password_hash(data: AuthUserUpdate__PasswordHash, db: Session) -> bool:
    user = get_authuser_by_id(data.id, db)
    if user is None:
        return False
    
    user.password_hash = data.password_hash
    db.commit()
    db.refresh(user)
    return True

def delete_user(id: int, db: Session) -> bool:
    assert False
    # TODO - no point rn tbh