from sqlalchemy import Column, ForeignKey, Integer, LargeBinary, String, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from db.base import Base
from datetime import datetime

from db.modules.users.models import User

class DocumentShare(Base):
    __tablename__ = "document_shares"

    doc_id = mapped_column(ForeignKey("documents.id"), primary_key=True)
    user_id = mapped_column(ForeignKey("users.id"), primary_key=True)

    permission = mapped_column(String, default="read")


    document: Mapped["Document"] = relationship(
        "Document", back_populates="shares"
    )
    user: Mapped["User"] = relationship(
        "User", back_populates="shares"
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DocumentBlock(Base):
    __tablename__ = "document_blocks"

    id: Mapped[str] = mapped_column(String, primary_key=True)

    doc_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    document: Mapped["Document"] = relationship(
        back_populates="blocks"
    )

    position: Mapped[int] = mapped_column(Integer, nullable=False)

    type: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False, default="")

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DocumentVersion(Base):
    """A point-in-time snapshot of a document's blocks, for version history / restore."""
    __tablename__ = "document_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    blocks_json: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class DocumentYDoc(Base):
    """Canonical Yjs CRDT state for a document; document_blocks is a derived read-model mirror."""
    __tablename__ = "document_ydocs"

    doc_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), primary_key=True)
    state: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    owner: Mapped["User"] = relationship("User")

    title: Mapped[str] = mapped_column(String, nullable=False, default="Untitled")


    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)

    blocks: Mapped[list["DocumentBlock"]] = relationship(
        "DocumentBlock",
        back_populates="document",
        order_by="DocumentBlock.position",
        cascade="all, delete-orphan"
    )
    
    shares: Mapped[list["DocumentShare"]] = relationship(
        "DocumentShare",
        back_populates="document",
        cascade="all, delete-orphan"
    )

    shared_users: Mapped[list["User"]] = relationship(
        "User",
        secondary="document_shares",
        viewonly=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
