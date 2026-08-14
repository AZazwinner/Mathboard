from typing import Literal
import uuid

from db.core.auth.schemas import AuthUserCreate__Password
from db.modules.docs.models import Document, DocumentBlock, DocumentShare, DocumentYDoc
from db.modules.users.models import User
from db.modules.users.schemas import UserCreate__AuthUser
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

def create_document_block(
        id: str,
        doc_id: int,
        position: int,
        type: str,
        db: Session
):
    db.execute(text("""
        UPDATE document_blocks
        SET position = position + 1
        WHERE doc_id = :doc_id AND position > :position
    """), {"doc_id": doc_id, "position": position}) # type: ignore

    block = DocumentBlock(
        id=id,
        doc_id=doc_id,
        position=position,
        type=type
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block

def delete_document_block(
        doc_id: int,
        position: int,
        db: Session
):
    block = get_document_block_by_ids(doc_id, position, db)

    # 1. delete block
    db.delete(block)

    # 2. shift positions
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
):
    obj = Document(owner_id=owner_id)
    db.add(obj)
    db.flush()
    create_document_block(
        id=str(uuid.uuid4()),
        doc_id=obj.id,
        position=0,
        type="paragraph",
        db=db
    )
    db.commit()
    db.refresh(obj)
    return obj

def get_docs_by_owner_id(
        owner_id: int,
        db: Session,
        n: int=50,
):
    return db.query(Document).filter(Document.owner_id == owner_id).all()

def get_document_by_id(
        id: int,
        db: Session,
):
    return db.query(Document).filter(Document.id == id).first()

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
    # blocks/shares cascade via the Document relationships (cascade="all,
    # delete-orphan"); the Yjs snapshot has no ORM relationship, so it's
    # removed explicitly
    db.query(DocumentYDoc).filter(DocumentYDoc.doc_id == doc.id).delete()
    db.delete(doc)
    db.commit()



# ---- DocumentShare ----
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