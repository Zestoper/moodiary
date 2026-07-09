from sqlalchemy import Column, Integer, String, UniqueConstraint
from ..core.database import Base

class UsageQuota(Base):
    __tablename__ = "usage_quotas"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    feature = Column(String(50), nullable=False)

    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    count = Column(Integer, default=0)

    __table_args__ = (UniqueConstraint('user_id', 'feature', 'year', 'month'),)
