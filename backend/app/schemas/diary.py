from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DiaryCreate(BaseModel):
    title: str
    content: str
    weather_code: Optional[int] = None
    temperature: Optional[float] = None

class DiaryUpdate(BaseModel):

    title: Optional[str] = None
    content: Optional[str] = None

class DiaryResponse(BaseModel):

    id: int
    user_id: int
    title: str
    content: str
    emotion_tags: Optional[str]
    emotion_score: Optional[int]
    weather_code: Optional[int]
    temperature: Optional[float]
    solution: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
