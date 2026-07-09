from sqlalchemy import Column, Integer, Float, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Diary(Base):
    __tablename__ = "diaries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    emotion_tags = Column(String(255), nullable=True)
    emotion_score = Column(Integer, nullable=True)

    weather_code = Column(Integer, nullable=True)
    temperature = Column(Float, nullable=True)
    solution = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="diaries")
