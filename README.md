# 📔 Moodiary

> 감정 일기를 쓰면 AI가 공감해주고, 감정 변화를 시각화해주는 **감정 기반 AI 다이어리 플랫폼**

**배포 주소**: Render (Backend) · Vercel (Frontend)  
**개발자**: 박준영 (1인 풀스택)

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| **감정 일기 + AI 분석** | 일기 작성 시 LLaMA 3.3 70B가 감정 태그(10종, 최대 3개)와 감정 점수(1~5)를 자동 추출. 브라우저 Geolocation + Open-Meteo로 날씨(WMO 코드, 기온) 자동 기록 |
| **AI 친구 채팅** | 6가지 페르소나(친구·멘토·상담사·응원단·심심이·현실주의자) 선택. Qwen3-32B 기반 SSE 스트리밍으로 실시간 타이핑 효과. 일기별 독립 채팅방(diary_id 기반) |
| **감정 캘린더** | 월별 달력에 감정 태그·점수 시각화 |
| **연애 상담** | 상황·내 행동·상대 행동 입력 → AI 잘잘못 판정 + 화해 문자 스크립트 자동 생성 |
| **AI 맞춤 솔루션** | 감정 점수 1~2점 일기 전용. 유저 취향(preferences) 반영 맞춤 활동 3가지 제안. 생성 결과 캐싱(재호출 시 AI 재사용 없음) |
| **월간 감정 리포트** | 해당 월 일기 전체를 AI가 분석해 서술형 감정 흐름 리포트 생성 |
| **YouTube 음악 추천** | 감정 태그·점수·장르 선호도 기반으로 YouTube Data API v3에서 플레이리스트 검색 추천 |
| **크레딧 결제** | PortOne(아임포트) 연동. 5/10/30 크레딧 패키지(1,500/2,900/7,900원) |
| **관리자 페이지** | 유저·일기·AI 사용량·결제 통계 대시보드. 크레딧 수동 지급 |

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| **Frontend** | React 19 · React Router v7 · Axios · Day.js · react-calendar |
| **Backend** | FastAPI · Uvicorn · SQLAlchemy · Alembic |
| **AI** | Groq API — LLaMA 3.3 70B (감정 분석·솔루션·상담·리포트) / Qwen3-32B (채팅 스트리밍) |
| **Database** | PostgreSQL · Supabase (개발: MySQL) |
| **인증** | JWT (python-jose) · Passlib · bcrypt |
| **외부 API** | YouTube Data API v3 · PortOne(아임포트) |
| **배포** | Render (Backend) · Vercel (Frontend) |

---

## 프로젝트 구조

```
Moodiary/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI 앱 진입점, 라우터 등록, startup 마이그레이션
│   │   ├── core/
│   │   │   ├── config.py          # 환경변수 (Pydantic Settings)
│   │   │   ├── database.py        # SQLAlchemy 엔진·세션
│   │   │   └── security.py        # JWT 생성·검증, bcrypt 해시
│   │   ├── models/                # SQLAlchemy ORM 모델 (6개 테이블)
│   │   ├── routers/               # API 엔드포인트 (auth/diary/chat/consult/report/music/payment/admin)
│   │   ├── schemas/               # Pydantic 요청·응답 스키마
│   │   └── services/
│   │       ├── groq.py            # Groq AI 호출 (감정 분석·채팅·솔루션·리포트·상담)
│   │       └── quota.py           # 쿼터 확인·소비·크레딧 차감 로직
│   ├── alembic/                   # DB 마이그레이션 히스토리
│   ├── render.yaml                # Render 배포 설정
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/                 # DiaryPage / CalendarPage / ChatPage / ConsultPage
        │                          # LoginPage / OnboardingPage / ProfilePage / PaymentPage / AdminPage
        ├── api/                   # API 호출 함수 (auth/diary/chat/consult/music/payment/report/admin)
        ├── components/            # 공통 컴포넌트 (BottomNav 등)
        ├── context/               # React Context (AuthContext, ToastContext)
        ├── constants/             # 페르소나 UI 텍스트 상수 (persona.js)
        └── hooks/                 # 커스텀 훅 (useTheme)
```

---

## 데이터베이스 구조

| 테이블 | 주요 컬럼 | 설명 |
|---|---|---|
| `users` | email, username, hashed_password, preferences(JSON), credits, is_admin | 회원 정보. preferences는 취향 설정(좋아요·싫어요 목록) |
| `diaries` | title, content, emotion_tags, emotion_score, solution, weather_code, temperature | 일기 본문 + AI 분석 결과. solution은 생성 후 캐싱 |
| `chat_messages` | role, content, diary_id(FK·nullable) | AI 채팅 내역. diary_id로 채팅방 구분. NULL이면 일반 채팅 |
| `consultations` | situation, my_action, partner_action, verdict, message_script | 연애 상담 내역 |
| `usage_quotas` | user_id, feature, year, month, count | AI 기능별 월별 사용 횟수. (user_id, feature, year, month) 복합 유니크 |
| `payments` | imp_uid(unique), merchant_uid(unique), amount, credits, status | PortOne 결제 내역. imp_uid 유니크로 중복 결제 방지 |

---

## 쿼터 & 크레딧 구조

AI 기능은 월별 무료 쿼터가 있으며, 초과 시 크레딧(1회 = 1 크레딧)을 차감합니다.  
크레딧도 없으면 HTTP 402를 반환하고 프론트는 결제 유도 모달을 표시합니다.

| 기능 | 월 무료 횟수 |
|---|---|
| 맞춤 솔루션 | 3회 |
| 연애 상담 | 5회 |
| 월간 리포트 | 1회 |

---

## 주요 API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 (JWT 발급) |
| GET | `/api/auth/me` | 내 정보 조회 |
| PATCH | `/api/auth/me` | 프로필·취향 설정 업데이트 |
| GET | `/api/diary` | 일기 목록 (최신순) |
| POST | `/api/diary` | 일기 작성 + AI 감정 분석 자동 실행 |
| GET | `/api/diary/{id}` | 일기 상세 조회 |
| PUT | `/api/diary/{id}` | 일기 수정 (내용 변경 시 감정 재분석 + 솔루션 초기화) |
| DELETE | `/api/diary/{id}` | 일기 삭제 |
| POST | `/api/diary/{id}/solution` | AI 맞춤 솔루션 생성 (감정 점수 1~2 전용, 쿼터 소비) |
| POST | `/api/chat/stream` | AI 채팅 SSE 스트리밍 (Qwen3-32B, 페르소나 지정) |
| POST | `/api/chat/send` | AI 채팅 메시지 전송 (비스트리밍, LLaMA 3.3 70B) |
| GET | `/api/chat/history` | 채팅 내역 조회 (`?diary_id=N`) |
| DELETE | `/api/chat/history` | 채팅 내역 삭제 (대화 초기화) |
| POST | `/api/consult` | 연애 상담 요청 (쿼터 소비) |
| GET | `/api/consult` | 상담 내역 목록 조회 |
| GET | `/api/consult/{id}` | 상담 상세 조회 |
| DELETE | `/api/consult/{id}` | 상담 삭제 |
| GET | `/api/report/monthly` | 월간 감정 리포트 (`?year=&month=`, 쿼터 소비) |
| GET | `/api/music/recommend` | 감정 기반 YouTube 플레이리스트 추천 (`?score=&tags=&genres=`) |
| GET | `/api/payment/packages` | 크레딧 패키지 목록 |
| POST | `/api/payment/verify` | PortOne 결제 검증 및 크레딧 지급 |
| GET | `/api/payment/history` | 결제 내역 조회 |
| GET | `/api/admin/stats` | 관리자: 대시보드 통계 |
| GET | `/api/admin/users` | 관리자: 유저 목록 |
| GET | `/api/admin/ai-usage` | 관리자: 이번 달 AI 사용량 집계 |
| GET | `/api/admin/payments` | 관리자: 결제 내역 |
| POST | `/api/admin/credits` | 관리자: 유저 크레딧 수동 지급 |

---

## 로컬 실행

### 1. 의존성 설치

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 2. 환경변수 설정

`backend/.env` 파일 생성:

```env
DATABASE_URL=postgresql://...        # Supabase 또는 로컬 PostgreSQL 연결 문자열
SECRET_KEY=your_jwt_secret_key
ALGORITHM=HS256
GROQ_API_KEY=your_groq_api_key

# 선택 사항 — 없으면 해당 기능 비활성화 또는 테스트 모드로 동작
YOUTUBE_API_KEY=your_youtube_api_key
PORTONE_IMP_KEY=your_portone_imp_key
PORTONE_IMP_SECRET=your_portone_imp_secret
```

### 3. 서버 실행

```bash
# Backend (http://localhost:8000)
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (http://localhost:3000)
cd frontend
npm start
```

> API 문서: http://localhost:8000/docs

---

## 기술적 의사결정

| 결정 | 선택 | 이유 |
|---|---|---|
| AI 모델 | Groq API (LLaMA 3.3 70B / Qwen3-32B) | 무료 고성능 + 빠른 응답속도. 한국어 품질 검증 후 Qwen3를 채팅 전용으로 분리 |
| 채팅 스트리밍 | SSE (Server-Sent Events) | WebSocket 대비 단방향 스트리밍에 적합, 연결 관리 단순 |
| DB | PostgreSQL (Supabase) | 개발 환경 MySQL, 배포는 Supabase 무료 플랜으로 빠른 배포 |
| 채팅 구조 | diary_id 기반 채팅방 분리 | 일기별 독립 컨텍스트 유지. diary_id=NULL은 일반 채팅 |
| 솔루션 캐싱 | diary.solution 컬럼에 저장 | 동일 일기 재요청 시 AI 재호출 없이 응답. 쿼터 절약 |

---

## 트러블슈팅

**Groq AI 응답에 한자·일본어 섞임**  
LLaMA 모델이 한국어 응답 중간에 간헐적으로 한자나 일본어를 출력하는 현상.  
→ `_filter_cjk()` 함수로 유니코드 범위 기반 정규식 필터 구현. 스트리밍 청크 단위 적용 시 단어 경계 공백 유지에 주의.

**Qwen3 스트리밍 중 `<think>` 태그 노출**  
Qwen3-32B 모델이 Chain-of-Thought 추론을 `<think>...</think>` 블록으로 응답에 포함.  
→ `_filter_think_tags()` 함수로 정규식 DOTALL 매칭 후 제거. 스트리밍 버퍼에서 `</think>` 감지 후 실제 응답만 yield.

**Groq AI 응답에 러시아어(키릴 문자) 섞임**  
Qwen3 모델이 한국어 응답 중간에 키릴 문자를 간헐적으로 출력 (예: `поддерж`).  
→ `_filter_cjk()` 정규식에 `Ѐ-ӿ` 범위 추가. 한자·일본어 필터와 동일 함수로 일괄 처리.

**결제 중복 처리 방지**  
네트워크 재시도로 동일 결제가 두 번 처리될 위험.  
→ `payments.imp_uid`와 `payments.merchant_uid`에 UNIQUE 제약 설정. DB INSERT 단계에서 중복 자동 차단.

**startup 마이그레이션 충돌**  
Alembic 미적용 상태로 배포 시 `is_admin`, `credits` 컬럼 누락으로 런타임 오류 발생.  
→ `main.py` startup 이벤트에서 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`로 간이 마이그레이션 추가.
