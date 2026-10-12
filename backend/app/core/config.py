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

    class Config:
        env_file = ".env"

settings = Settings()
