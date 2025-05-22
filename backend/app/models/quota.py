# ─── AI 기능 사용 쿼터(횟수 제한) 테이블 모델 ──────────────────────────────────────
# 유저별 / 기능별 / 월별 사용 횟수를 기록
# 무료 한도를 초과했는지 판단하는 데 사용됨

from sqlalchemy import Column, Integer, String, UniqueConstraint  # DB 컬럼 타입 + 복합 유니크 제약
from ..core.database import Base                                   # ORM 모델 부모 클래스


class UsageQuota(Base):
    __tablename__ = "usage_quotas"  # DB에 생성될 테이블 이름

    id = Column(Integer, primary_key=True, index=True)  # 기본키(PK). 자동 증가
    user_id = Column(Integer, nullable=False, index=True)
    # 어떤 유저의 사용량인지 저장. index=True로 user_id 기준 빠른 조회 가능
    feature = Column(String(50), nullable=False)
    # 어떤 AI 기능인지. 'solution'(맞춤 솔루션) / 'consult'(연애 상담) / 'monthly_report'(월간 리포트)
    year = Column(Integer, nullable=False)   # 연도. 예: 2025
    month = Column(Integer, nullable=False)  # 월. 예: 1~12
    count = Column(Integer, default=0)       # 해당 월 사용 횟수. 기능 호출 시마다 +1

    # UniqueConstraint: 한 유저가 같은 기능 + 같은 연/월에 중복 레코드 생기지 않도록 막음
    # 예: user_id=1, feature='solution', year=2025, month=5 → 이 조합은 DB에 딱 하나만 존재
    __table_args__ = (UniqueConstraint('user_id', 'feature', 'year', 'month'),)
