from sqlalchemy import Column, DateTime, ForeignKey, String, Integer
from sqlalchemy.sql import func
from ..core.database import Base


class SocialAccount(Base):
    """소셜 로그인 연결 정보 — 구글/카카오 계정 하나가 우리 회원 한 명에 연결된다.

    한 회원이 구글과 카카오를 둘 다 연결할 수 있도록 users 테이블에 컬럼을 넣지 않고 따로 둔다.
    """
    __tablename__ = "user_social_accounts"

    provider    = Column(String(20), primary_key=True)    # google · kakao
    provider_id = Column(String(255), primary_key=True)   # 구글/카카오가 주는 고유 번호
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
