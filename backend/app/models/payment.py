from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from ..core.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    imp_uid = Column(String(100), unique=True, nullable=False)

    merchant_uid = Column(String(100), unique=True, nullable=False)

    amount = Column(Integer, nullable=False)
    credits = Column(Integer, nullable=False)
    status = Column(String(20), default='paid')

    created_at = Column(DateTime, server_default=func.now())
