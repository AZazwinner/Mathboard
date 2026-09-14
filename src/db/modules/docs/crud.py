from datetime import datetime
from typing import Literal
import uuid

from db.core.auth.schemas import AuthUserCreate__Password
from db.modules.docs.models import Document, DocumentBlock, DocumentShare, DocumentVersion, DocumentYDoc
from db.modules.users.models import User
from db.modules.users.schemas import UserCreate__AuthUser
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

def delete_document_block(
        doc_id: int,
        position: int,
        db: Session
):
    block = get_document_block_by_ids(doc_id, position, db)

    db.delete(block)

    db.execute(text("""
        UPDATE document_blocks
        SET position = position - 1
        WHERE doc_id = :doc_id AND position > :position
    """), {"doc_id": doc_id, "position": position})

    db.commit()
    return

def get_document_block_by_id(
        id: int,
        db: Session
):
    return db.query(DocumentBlock).filter(
        DocumentBlock.id == id
    ).first()

def get_document_block_by_ids(
        doc_id: int,
        position: int,
        db: Session
):
    return db.query(DocumentBlock).filter(
        DocumentBlock.doc_id == doc_id,
        DocumentBlock.position == position
    ).first()

def create_document(
        owner_id: int,
        db: Session,
        title: str | None = None,
        block_contents: list[str] | None = None,
):
    """One DocumentBlock per string in block_contents, or a single empty block if omitted."""
    obj = Document(owner_id=owner_id)
    if title:
        obj.title = title
    db.add(obj)
    db.flush()

    for position, content in enumerate(block_contents or [""]):
        db.add(DocumentBlock(
            id=str(uuid.uuid4()),
            doc_id=obj.id,
            position=position,
            type="paragraph",
            content=content,
        ))

    db.commit()
    db.refresh(obj)
    return obj

def create_document_copy(
        owner_id: int,
        title: str,
        blocks: list[DocumentBlock],
        db: Session,
):
    obj = Document(owner_id=owner_id, title=title)
    db.add(obj)
    db.flush()
    for block in blocks:
        db.add(DocumentBlock(
            id=str(uuid.uuid4()),
            doc_id=obj.id,
            position=block.position,
            type=block.type,
            content=block.content,
        ))
    db.commit()
    db.refresh(obj)
    return obj

def get_docs_by_owner_id(
        owner_id: int,
        db: Session,
        n: int=50,
):
    return db.query(Document).filter(
        Document.owner_id == owner_id,
        Document.deleted_at.is_(None),
    ).all()

def get_trashed_docs_by_owner_id(
        owner_id: int,
        db: Session,
):
    return (
        db.query(Document)
        .filter(Document.owner_id == owner_id, Document.deleted_at.isnot(None))
        .order_by(Document.deleted_at.desc())
        .all()
    )

def get_document_by_id(
        id: int,
        db: Session,
        include_deleted: bool = False,
):
    """Excludes soft-deleted documents unless include_deleted=True."""
    q = db.query(Document).filter(Document.id == id)
    if not include_deleted:
        q = q.filter(Document.deleted_at.is_(None))
    return q.first()

def soft_delete_document(
        doc: Document,
        db: Session,
):
    doc.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return doc

def restore_document(
        doc: Document,
        db: Session,
):
    doc.deleted_at = None
    db.commit()
    db.refresh(doc)
    return doc

def get_document_versions(doc_id: int, db: Session):
    return (
        db.query(DocumentVersion)
        .filter(DocumentVersion.doc_id == doc_id)
        .order_by(DocumentVersion.created_at.desc())
        .all()
    )

def get_document_version_by_id(version_id: int, db: Session) -> DocumentVersion | None:
    return db.query(DocumentVersion).filter(DocumentVersion.id == version_id).first()

def restore_document_from_snapshot(doc_id: int, blocks: list[dict], db: Session) -> None:
    """Rewrites document_blocks to match a version snapshot, then rebuilds the canonical Y.Doc state from those rows. Callers must ensure no YRoom is currently live for this doc."""
    from db.modules.liveshare.backfill import new_ydoc_from_blocks, persist_ydoc_state

    db.execute(text("DELETE FROM document_blocks WHERE doc_id = :doc_id"), {"doc_id": doc_id})
    for position, block in enumerate(blocks):
        db.add(DocumentBlock(
            id=block["id"],
            doc_id=doc_id,
            position=position,
            type=block["type"],
            content=block["text"],
        ))
    db.commit()

    restored_blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.doc_id == doc_id)
        .order_by(DocumentBlock.position)
        .all()
    )
    ydoc = new_ydoc_from_blocks(restored_blocks)
    persist_ydoc_state(doc_id, ydoc, db)

def update_document__title_text(
        doc: Document,
        db: Session,
        title: str|None=None,
        text: str|None=None,
):
    if title is not None:
        doc.title = title
    if text is not None:
        doc.text = text

    db.commit()
    db.refresh(doc)
    return True


def delete_document(
        doc: Document,
        db: Session,
):

    db.query(DocumentYDoc).filter(DocumentYDoc.doc_id == doc.id).delete()
    db.delete(doc)
    db.commit()



def create_documentshare(
        doc_id: int,
        user_id: int,
        share_type: str,
        db: Session
):
    """
    share_type: read/write
    """
    share = DocumentShare(
        doc_id=doc_id,
        user_id=user_id,
        permission=share_type
    )
    db.add(share)
    db.commit()

def get_documentshare_by_ids(
        doc_id: int,
        user_id: int,
        db: Session
):
    return (
        db.query(DocumentShare)
        .filter(
            DocumentShare.doc_id == doc_id,
            DocumentShare.user_id == user_id
        )
        .first()
    )

def get_documentshares_by_id(
        doc_id: int,
        db: Session
):
    return (
        db.query(DocumentShare)
        .filter(
            DocumentShare.doc_id == doc_id
        )
        .all()
    )

def get_documentshares_by_user_id(
        user_id: int,
        db: Session
):
    return (
        db.query(DocumentShare)
        .filter(
            DocumentShare.user_id == user_id
        )
        .all()
    )
    

def update_documentshare(
        doc_id: int,
        user_id: int,
        share_type: str,
        db: Session
) -> bool:
    share = get_documentshare_by_ids(
        doc_id=doc_id,
        user_id=user_id,
        db=db
    )
    if share is None:
        return False
    
    return update_documentshare_with_share(share, share_type, db)

def update_documentshare_with_share(
        share: DocumentShare,
        share_type: str,
        db: Session
):
    share.permission = share_type
    db.commit()
    db.refresh(share)
    return True
    
def delete_documentshare(
        doc_id: int,
        user_id: int,
        db: Session
):
    docshare = get_documentshare_by_ids(doc_id, user_id, db)
    db.delete(docshare)
    db.commit()