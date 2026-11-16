from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GROQ_API_KEY: str
    CEREBRAS_API_KEY: Optional[str] = None  # Groq 모델이 전부 막혔을 때 쓰는 폴백 (없으면 폴백 안 함)

    YOUTUBE_API_KEY: Optional[str] = None

    PORTONE_IMP_KEY: Optional[str] = None
    PORTONE_IMP_SECRET: Optional[str] = None

    # 소셜 로그인 (구글 · 카카오) — app/routers/oauth.py
    BACKEND_URL: str = ""            # 이 서버 주소. 비우면 Render 주소 → http://localhost:8000 순으로 잡는다
    FRONTEND_URL: str = "http://localhost:3000"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    KAKAO_REST_API_KEY: str = ""
    KAKAO_CLIENT_SECRET: str = ""    # 카카오 콘솔에서 Client Secret 을 '사용'으로 켰을 때만

    class Config:
        env_file = ".env"

settings = Settings()
