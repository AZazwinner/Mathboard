from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from db.base import Base
from datetime import datetime

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from db.modules.docs.models import Document
    from db.modules.docs.models import DocumentShare

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    authuser_id: Mapped[int] = mapped_column(ForeignKey("auth_users.id"))
    authuser = relationship("AuthUser")

    # username: Mapped[str] = mapped_column(ForeignKey("auth_users.username"))
    # email: Mapped[str] = mapped_column(ForeignKey("auth_users.email"))

    # documents: Mapped[list["Document"]] = relationship(
    #     "Document", back_populates="owner"
    # )

    owned_documents: Mapped[list["Document"]] = relationship(
        "Document",
        back_populates="owner"
    )

    shares: Mapped[list["DocumentShare"]] = relationship(
        "DocumentShare",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    shared_documents: Mapped[list["Document"]] = relationship(
        "Document",
        secondary="document_shares",
        viewonly=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
