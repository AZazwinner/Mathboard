from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.core.auth.schemas import AuthUserUpdate__Password
from db.core.auth.services import update_authuser__password
from db.modules.docs.crud import get_docs_by_owner_id, get_documentshares_by_id
from db.modules.docs.schemas import DocShareListingResponse, DocumentResponsePermission, DocumentShareResponseExpanded, DocumentResponse, DocumentUpdate
from db.modules.docs.services import create_empty_untitled_doc, delete_docshare__check_permissions, get_viewable_documents, try_create_or_update_documentshare, try_get_documentshares, update_doc_text__check_permissions, delete_doc__check_permissions, try_get_documentshare, user_can_write_document, view_document
from db.modules.users.crud import get_user_by_id
from db.modules.users.models import User
from db.modules.users.schemas import UserPublicResponse, UserPrivateResponse
from db.modules.users.services import get_current_user
from db.database import get_db

router = APIRouter()

class CreateDocData(BaseModel):
    template: Optional[str] = "Blank Document"
    title: Optional[str] = "New document"

class CreateDocResponse(BaseModel):
    doc_id: int

@router.post("/docs/new", response_model=CreateDocResponse)
def create_doc(
    data: CreateDocData,
    current_user: UserPrivateResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = create_empty_untitled_doc(current_user.id, db)
    return {
        "doc_id": doc.id
    }

class DocsResponse(BaseModel):
    docs: list[DocumentResponse]

@router.get("/my-docs", response_model=DocsResponse)
def get_docs(
    own: bool = True,
    current_user: UserPrivateResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if own:
        return {
            "docs": get_docs_by_owner_id(current_user.id, db)
        }
    return {
        "docs": []
    }

class DocsSharedResponse(BaseModel):
    docs: list[DocShareListingResponse]
    
@router.get("/shared-docs", response_model=DocsSharedResponse)
def get_shared_docs(
    current_user: UserPrivateResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {
        "docs": get_viewable_documents(current_user.id, db)
    }
    
@router.get("/docs/{doc_id}", response_model=DocumentResponsePermission|None)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = view_document(doc_id, current_user.id, db)
    if doc is None:
        return None
    
    if doc.owner_id == current_user.id:
        permission = "write" # owner
    elif user_can_write_document(doc_id, current_user.id, db):
        permission = "write"
    else:
        permission = "read"
    
    return {
        **DocumentResponse.model_validate(doc).model_dump(),
        "permission": permission,
        "owner_username": doc.owner.authuser.username
    }

class SuccessResponse(BaseModel):
    success: bool

class UpdateDocData(BaseModel):
    doc_id: int
    title: Optional[str|None]=None
    text: Optional[str|None]=None

@router.post("/update-doc", response_model=SuccessResponse)
def update_doc_text(
    data: UpdateDocData,
    current_user: UserPrivateResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = DocumentUpdate.model_validate({
        "text": data.text,
        "title": data.title,
    })
    success = update_doc_text__check_permissions(
        doc_id=data.doc_id,
        user_id=current_user.id,
        update_data=update_data,
        db=db
    )
    return {
        "success": success
    }

@router.delete("/doc", response_model=SuccessResponse)
def delete_doc(
    doc_id: int,
    current_user: UserPrivateResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = delete_doc__check_permissions(
        doc_id=doc_id,
        user_id=current_user.id,
        db=db
    )
    return {
        "success": success
    }


# ---- DocumentShare ----
class DocShareData(BaseModel):
    doc_id: int
    user_id: int
    share_type: str

    model_config = {
        "from_attributes": True
    }

@router.post("/doc-share", response_model=SuccessResponse)
def share_doc(
    data: DocShareData,
    current_user: UserPrivateResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = try_create_or_update_documentshare(
        doc_id=data.doc_id,
        user_id=data.user_id,
        inviter_id=current_user.id,
        share_type=data.share_type,
        db=db
    )
    return {
        "success": success
    }

@router.get("/doc-shares", response_model=list[DocumentShareResponseExpanded])
def get_docshare(
    doc_id: int,
    current_user: UserPrivateResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return try_get_documentshares(
        doc_id=doc_id,
        user_id=current_user.id,
        db=db
    )

class DocShareDeleteData(BaseModel):
    doc_id: int
    user_id: int

@router.delete("/doc-share", response_model=SuccessResponse)
def delete_docshare(
    data: DocShareDeleteData,
    current_user: UserPrivateResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = delete_docshare__check_permissions(
        doc_id=data.doc_id,
        user_id=data.user_id,
        requester_id=current_user.id,
        db=db
    )
    return {
        "success": success
    }
