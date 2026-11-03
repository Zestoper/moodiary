from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..core.timeutil import UTCDateTime

class ChatMessageCreate(BaseModel):

    content: str
    diary_id: Optional[int] = None

    persona: Optional[str] = "friend"

class ChatMessageResponse(BaseModel):

    id: int
    user_id: int
    role: str
    content: str
    diary_id: Optional[int] = None
    memory_refs: Optional[str] = None
    created_at: UTCDateTime

    class Config:
        from_attributes = True

class ChatResponse(BaseModel):

    user_message: ChatMessageResponse
    ai_message: ChatMessageResponse
