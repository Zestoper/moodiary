from sqlalchemy import Boolean, Column, Date, Integer, Float, String, Text, DateTime, ForeignKey
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

    # AI 친구의 기억 (services/memory.py) — 일기 저장 후 백그라운드에서 채운다
    memory = Column(Text, nullable=True)                 # 나중에 떠올릴 1~2문장 요약
    memory_keywords = Column(String(255), nullable=True) # 검색용 핵심어 (쉼표 구분)
    follow_up = Column(String(255), nullable=True)       # 나중에 먼저 물어볼 질문
    follow_up_date = Column(Date, nullable=True)         # 그 일이 있는 날
    follow_up_asked = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="diaries")
