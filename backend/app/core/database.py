from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Render 무료 서버가 잠들었다 깨어나면 DB(Supabase)가 이미 끊어 둔 연결을 그대로 꺼내 써서
# 'SSL connection has been closed unexpectedly' 로 첫 요청(로그인 등)이 실패했다.
# pool_pre_ping: 꺼내기 전에 살아 있는지 확인하고 죽었으면 새로 연결 / pool_recycle: 5분 넘은 연결은 교체
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
