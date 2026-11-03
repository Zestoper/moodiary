from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..core.timeutil import UTCDateTime

class ConsultCreate(BaseModel):

    situation: str
    my_action: Optional[str] = None
    partner_action: Optional[str] = None

class ConsultResponse(BaseModel):

    id: int
    user_id: int
    situation: str
    my_action: Optional[str]
    partner_action: Optional[str]
    verdict: Optional[str]
    message_script: Optional[str]
    created_at: UTCDateTime

    class Config:
        from_attributes = True
