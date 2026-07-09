from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from ..core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, nullable=False)
    username = Column(String(50), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    preferences = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    is_admin = Column(Boolean, default=False, nullable=False)

    credits = Column(Integer, default=0, nullable=False)
