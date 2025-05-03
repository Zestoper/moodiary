from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GROQ_API_KEY: str
    # YouTube API 키 없어도 앱 동작. 음악 추천 기능만 비활성화됨
    # console.cloud.google.com → YouTube Data API v3 활성화 → API 키 발급
    YOUTUBE_API_KEY: Optional[str] = None
    # ── PortOne(아임포트) 결제 설정 ───────────────────────────────────────────────
    # 미설정 시 테스트 모드로 동작: 실제 결제 없이 크레딧만 지급됨
    # portone.io 가입 → 내 식별코드(IMP_KEY) + REST API 키(IMP_SECRET) 발급 후 .env에 추가
    PORTONE_IMP_KEY: Optional[str] = None       # PortOne REST API 인증 키
    PORTONE_IMP_SECRET: Optional[str] = None    # PortOne REST API 인증 시크릿

    class Config:
        env_file = ".env"


# 앱 전체에서 공유하는 설정 인스턴스. 모듈 수준에서 한 번만 생성됨(싱글턴)
# 다른 파일에서: from app.core.config import settings 로 가져다 사용
settings = Settings()
