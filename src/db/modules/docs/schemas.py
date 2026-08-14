

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from db.modules.users.schemas import UserPublicResponse


class DocumentUpdate(BaseModel):
    text: Optional[str]=None
    title: Optional[str]=None

class DocumentBlockResponse(BaseModel):
    id: str
    doc_id: int
    position: int
    type: str
    content: str
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }

class DocumentResponse(BaseModel):
    id: int

    owner_id: int
    owner: UserPublicResponse

    title: str
    blocks: list[DocumentBlockResponse]

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }
    
class DocumentResponsePermission(DocumentResponse):
    permission: str
    owner_username: str



class DocumentShareResponse(BaseModel):
    doc_id: int
    user_id: int
    permission: str
    
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }

class DocumentShareResponseExpanded(DocumentShareResponse):
    username: str

    model_config = {
        "from_attributes": True
    }


class DocShareListingResponse(BaseModel):
    id: int
    owner_id: int
    owner_username: str
    title: str
    created_at: datetime
    updated_at: datetime
    permission: str

