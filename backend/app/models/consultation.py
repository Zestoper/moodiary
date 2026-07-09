from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    situation = Column(Text, nullable=False)
    my_action = Column(Text, nullable=True)
    partner_action = Column(Text, nullable=True)

    verdict = Column(String(50), nullable=True)
    message_script = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", backref="consultations")
