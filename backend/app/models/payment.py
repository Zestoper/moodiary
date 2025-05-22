# ─── 결제 내역 테이블 모델 ──────────────────────────────────────────────────────────
# 크레딧 충전 결제가 완료될 때마다 하나씩 기록됨
# imp_uid: PortOne이 발급하는 결제 고유 ID. 중복 결제 방지에 사용

from sqlalchemy import Column, Integer, String, DateTime  # DB 컬럼 타입
from sqlalchemy.sql import func                           # func.now(): DB 서버 시간 자동 기록
from ..core.database import Base                          # ORM 모델 부모 클래스


class Payment(Base):
    __tablename__ = "payments"  # DB에 생성될 테이블 이름

    id = Column(Integer, primary_key=True, index=True)   # 기본키(PK). 자동 증가
    user_id = Column(Integer, nullable=False, index=True)
    # 어떤 유저의 결제인지 저장. index=True로 user_id 기준 빠른 조회 가능
    imp_uid = Column(String(100), unique=True, nullable=False)
    # PortOne(아임포트)이 발급하는 결제 고유 ID. unique=True로 동일 결제를 두 번 처리하는 걸 방지
    merchant_uid = Column(String(100), unique=True, nullable=False)
    # 우리 서버가 생성한 주문 고유 ID. unique=True로 주문 중복 방지
    amount = Column(Integer, nullable=False)   # 결제 금액(원). 예: 1500, 2900, 7900
    credits = Column(Integer, nullable=False)  # 지급된 크레딧 수. 예: 5, 10, 30
    status = Column(String(20), default='paid')
    # 결제 상태. 'paid'(정상 결제) / 'test'(PortOne 미설정 테스트 모드) 등
    created_at = Column(DateTime, server_default=func.now())
    # 결제가 기록된 시각. server_default=func.now(): INSERT 시 DB 서버 현재 시각으로 자동 채워짐
