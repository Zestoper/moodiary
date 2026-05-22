from fastapi import FastAPI                        # FastAPI 클래스 임포트. 앱 인스턴스를 만드는 데 사용
from fastapi.middleware.cors import CORSMiddleware  # CORS 미들웨어. 브라우저의 교차 출처 요청 허용에 사용
from .routers import auth, diary, chat, consult, music, report, payment, admin
from .core.database import engine
from sqlalchemy import text

app = FastAPI(title="Moodiary API")  # FastAPI 인스턴스 생성. title은 /docs 자동 문서 페이지에 제목으로 표시됨


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

    # ORM 모델이 정의된 테이블을 모두 생성 (이미 있으면 스킵)
    Base.metadata.create_all(bind=engine)

    # users 테이블에 is_admin, credits 컬럼이 없을 수 있으므로 수동으로 추가 시도
    # PostgreSQL은 IF NOT EXISTS를 지원하므로 오류 없이 처리 가능
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INT NOT NULL DEFAULT 0"))
        conn.commit()

# add_middleware: 모든 요청이 라우터에 도달하기 전에 거치는 처리 로직을 등록
# CORS란? 브라우저가 다른 출처(포트/도메인)로 요청할 때 보안상 막는 정책. 이걸 풀어줘야 프론트(3000)→백엔드(8000) 통신 가능
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 모든 출처 허용 (포트폴리오용)
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include_router: 별도 파일로 분리한 라우터를 앱에 연결
# prefix: 이 라우터의 모든 경로 앞에 자동으로 붙는 URL 접두사
# tags: /docs 페이지에서 엔드포인트를 묶어 보여주는 그룹 이름
# 예시) auth.py의 @router.post("/login") → 실제 접근 URL: /api/auth/login
app.include_router(auth.router,   prefix="/api/auth",   tags=["auth"])    # 회원가입/로그인/내 정보
app.include_router(diary.router,  prefix="/api/diary",  tags=["diary"])   # 일기 CRUD
app.include_router(chat.router,   prefix="/api/chat",   tags=["chat"])    # AI 채팅
app.include_router(consult.router, prefix="/api/consult", tags=["consult"])
app.include_router(music.router,  prefix="/api/music",  tags=["music"])   # 음악 추천 (Spotify)
app.include_router(report.router,   prefix="/api/report",   tags=["report"])    # 월간 감정 리포트
app.include_router(payment.router,  prefix="/api/payment",  tags=["payment"])   # 크레딧 결제
app.include_router(admin.router,    prefix="/api/admin",    tags=["admin"])     # 관리자


@app.get("/")           # GET 메서드로 "/" 경로에 엔드포인트 등록. 서버가 살아있는지 확인하는 헬스체크용
def root():
    return {"message": "Moodiary API"}  # dict를 반환하면 FastAPI가 자동으로 JSON으로 변환해서 응답
