from pydantic import BaseModel
from typing import Optional
from datetime import datetime

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
    created_at: datetime

    class Config:
        from_attributes = True
