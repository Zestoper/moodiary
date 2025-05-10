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
    # 날씨 정보. 일기 작성 시 자동 기록. 없어도 됨(nullable)
    # weather_code: WMO 기상 코드. 0=맑음, 61=비, 71=눈, 95=뇌우 등
    # temperature: 섭씨 기온
    weather_code = Column(Integer, nullable=True)
    temperature = Column(Float, nullable=True)
    solution = Column(Text, nullable=True)  # AI 생성 맞춤 솔루션. 한 번 생성 후 재사용
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="diaries")
