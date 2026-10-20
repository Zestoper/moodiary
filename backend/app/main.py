import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, diary, chat, consult, music, report, payment, admin
from .core.database import engine
from sqlalchemy import text

app = FastAPI(title="Moodiary API")

@app.on_event("startup")
def migrate_db():
    """
    앱 시작 시 누락된 컬럼을 자동으로 추가하는 간이 마이그레이션.
    이미 컬럼이 있으면 오류 없이 넘어감(IF NOT EXISTS 사용).
    usage_quotas, payments 테이블도 없으면 생성.
    """
    from .models.user import User
    from .models.quota import UsageQuota
    from .models.payment import Payment
    from .core.database import Base

    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INT NOT NULL DEFAULT 0"))
        conn.commit()

app.add_middleware(
    CORSMiddleware,
    # 우리 프런트(배포 · Vercel 미리보기 · 로컬)만 허용. 다른 주소는 CORS_ORIGINS 환경변수에 쉼표로 추가
    allow_origins=[o.strip() for o in os.getenv(
        "CORS_ORIGINS",
        "https://moodiary-five.vercel.app,https://moodiary.vercel.app,http://localhost:3000",
    ).split(",") if o.strip()],
    allow_origin_regex=r"https://moodiary[a-z0-9-]*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,   prefix="/api/auth",   tags=["auth"])
app.include_router(diary.router,  prefix="/api/diary",  tags=["diary"])
app.include_router(chat.router,   prefix="/api/chat",   tags=["chat"])
app.include_router(consult.router, prefix="/api/consult", tags=["consult"])
app.include_router(music.router,  prefix="/api/music",  tags=["music"])
app.include_router(report.router,   prefix="/api/report",   tags=["report"])
app.include_router(payment.router,  prefix="/api/payment",  tags=["payment"])
app.include_router(admin.router,    prefix="/api/admin",    tags=["admin"])

@app.get("/")
def root():
    return {"message": "Moodiary API"}


# 프론트 ServerWakeGate·UptimeRobot(HEAD) 용 가벼운 헬스체크
@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}
