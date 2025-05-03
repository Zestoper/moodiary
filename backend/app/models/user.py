from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean  # DB 컬럼 타입들을 가져옴. Boolean: True/False 값 저장
from sqlalchemy.sql import func                           # func.now() 같은 SQL 함수 사용을 위해 임포트
from ..core.database import Base                          # 모든 모델이 상속받아야 하는 Base 클래스


# Base를 상속받으면 이 클래스가 DB 테이블과 연결된 ORM 모델이 됨
# ORM이란? 파이썬 클래스로 DB 테이블을 다루는 방식. SQL을 직접 안 써도 됨
class User(Base):
    __tablename__ = "users"  # 실제 MySQL에서 생성될 테이블 이름

    # Column(타입, 옵션): DB의 컬럼 하나를 정의
    id = Column(Integer, primary_key=True, index=True)  # 기본키(PK). 자동 증가(1,2,3...). index=True로 빠른 조회
    email = Column(String(100), unique=True, nullable=False)      # 이메일. 중복 불가(unique), 필수(nullable=False)
    username = Column(String(50), nullable=False)                  # 닉네임. 필수
    hashed_password = Column(String(255), nullable=False)
    preferences = Column(Text, nullable=True)  # JSON 문자열: {"likes":["음악","산책"],"dislikes":["운동"]}
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    # ── 관리자 / 크레딧 컬럼 (신규 추가) ─────────────────────────────────────────
    is_admin = Column(Boolean, default=False, nullable=False)
    # is_admin: 관리자 여부. True면 /api/admin 엔드포인트 접근 가능. 기본값 False(일반 유저)
    credits = Column(Integer, default=0, nullable=False)
    # credits: 보유 크레딧 수. 무료 쿼터 소진 후 AI 기능 1회 사용 시 1 차감. 기본값 0
