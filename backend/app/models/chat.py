from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    diary_id = Column(Integer, ForeignKey("diaries.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", backref="chat_messages")
