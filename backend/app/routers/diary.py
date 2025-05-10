# ─── 일기 CRUD API 엔드포인트 (목록조회 / 작성 / 상세조회 / 수정 / 삭제) ──────────

from fastapi import APIRouter, Depends, HTTPException  # APIRouter: 라우터 그룹
                                                        # Depends: 의존성 주입 (DB세션, 현재유저)
                                                        # HTTPException: 404, 403 같은 에러 발생시킬 때 사용

from sqlalchemy.orm import Session   # DB 세션 타입. 함수 인자에 타입 힌트로 사용
from typing import List              # List[DiaryResponse]: DiaryResponse 객체들의 리스트 타입

from ..core.database import get_db               # DB 세션 생성 함수. Depends()와 함께 사용
from ..models.diary import Diary                 # Diary ORM 모델. diaries 테이블과 연결
from ..models.user import User                   # User ORM 모델. 현재 로그인된 유저 타입으로 사용
from ..schemas.diary import DiaryCreate, DiaryUpdate, DiaryResponse  # 요청/응답 스키마
from ..routers.auth import get_current_user      # 로그인된 유저를 가져오는 의존성 함수
                                                  # 토큰이 없거나 유효하지 않으면 자동으로 401 에러 반환
from ..services.groq import analyze_emotion, generate_solution
from ..services.quota import check_and_consume
import json

router = APIRouter()  # main.py에서 prefix="/api/diary" 로 등록됨


# ── 일기 목록 조회 ────────────────────────────────────────────────────────────────
@router.get("/", response_model=List[DiaryResponse])
# response_model=List[DiaryResponse]: 반환값이 DiaryResponse 객체들의 리스트임을 명시
# List[DiaryResponse] → [{"id":1,"title":"..."}, {"id":2,"title":"..."}, ...] 형태로 자동 변환
def get_diaries(
    db: Session = Depends(get_db),                    # DB 세션 자동 주입
    current_user: User = Depends(get_current_user)    # 로그인된 유저 자동 주입. 비로그인이면 401 에러
):
    diaries = db.query(Diary)\
        .filter(Diary.user_id == current_user.id)\
        .order_by(Diary.created_at.desc())\
        .all()
    # db.query(Diary): diaries 테이블 조회 시작
    # .filter(Diary.user_id == current_user.id): 내 일기만 필터링 (다른 유저 일기 못 봄)
    # .order_by(Diary.created_at.desc()): 최신 일기가 먼저 오도록 내림차순 정렬
    # .all(): 조건에 맞는 전체 결과를 리스트로 반환

    return diaries  # response_model이 자동으로 List[DiaryResponse] 형태로 변환해서 반환


# ── 일기 작성 ─────────────────────────────────────────────────────────────────────
@router.post("/", response_model=DiaryResponse, status_code=201)
# status_code=201: 새 리소스 생성 성공을 나타내는 HTTP 상태 코드
def create_diary(
    body: DiaryCreate,                                # 요청 바디. title과 content를 받음
    db: Session = Depends(get_db),                    # DB 세션 자동 주입
    current_user: User = Depends(get_current_user)    # 로그인된 유저 자동 주입
):
    # 감정 분석: 일기 본문을 Groq AI에 보내서 감정 태그와 점수를 받아옴
    emotion_tags = None   # 분석 실패해도 일기 저장은 되게 None으로 초기화
    emotion_score = None  # 분석 실패해도 일기 저장은 되게 None으로 초기화
    try:
        emotion_result = analyze_emotion(body.content)
        # analyze_emotion 호출. 반환값 예: {"emotion_tags": "기쁨,설렘", "emotion_score": 4}

        emotion_tags = emotion_result.get("emotion_tags")
        # dict에서 "emotion_tags" 키의 값을 꺼냄. 없으면 None

        emotion_score = emotion_result.get("emotion_score")
        # dict에서 "emotion_score" 키의 값을 꺼냄. 없으면 None
    except Exception:
        pass
        # AI 호출 실패(네트워크 오류, API 키 오류 등)해도 일기 저장은 정상 진행
        # 감정 분석 실패 시 emotion_tags, emotion_score는 None으로 저장됨

    new_diary = Diary(
        user_id=current_user.id,
        title=body.title,
        content=body.content,
        emotion_tags=emotion_tags,
        emotion_score=emotion_score,
        weather_code=body.weather_code,   # 프론트 geolocation → Open-Meteo에서 가져온 날씨 코드
        temperature=body.temperature,
    )

    db.add(new_diary)      # DB 세션에 새 일기 추가
    db.commit()            # DB에 INSERT 쿼리 실행
    db.refresh(new_diary)  # DB에서 갱신된 값(id, created_at 등) 다시 읽어옴

    return new_diary


# ── 일기 상세 조회 ────────────────────────────────────────────────────────────────
@router.get("/{diary_id}", response_model=DiaryResponse)
# {diary_id}: URL에서 숫자를 받는 경로 매개변수. /api/diary/3 → diary_id = 3
def get_diary(
    diary_id: int,                                    # URL에서 추출한 일기 ID. FastAPI가 자동으로 int로 변환
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary)\
        .filter(Diary.id == diary_id, Diary.user_id == current_user.id)\
        .first()
    # .filter(조건1, 조건2): AND 조건. 두 조건 모두 만족해야 함
    # Diary.id == diary_id: 해당 ID의 일기인지
    # Diary.user_id == current_user.id: 내 일기인지 (다른 유저 일기를 ID로 직접 접근 방지)
    # .first(): 결과가 있으면 Diary 객체, 없으면 None 반환

    if diary is None:
        # None이면 해당 일기가 없거나 내 일기가 아닌 경우
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다")
        # 404: Not Found. 요청한 리소스가 없다는 HTTP 상태 코드

    return diary


# ── 일기 수정 ─────────────────────────────────────────────────────────────────────
@router.put("/{diary_id}", response_model=DiaryResponse)
# PUT: 기존 데이터를 수정할 때 사용하는 HTTP 메서드
def update_diary(
    diary_id: int,                                    # 수정할 일기 ID
    body: DiaryUpdate,                                # 수정할 내용. title, content 둘 다 Optional
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary)\
        .filter(Diary.id == diary_id, Diary.user_id == current_user.id)\
        .first()
    # 수정 전에 해당 일기가 존재하고 내 것인지 먼저 확인

    if diary is None:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다")

    if body.title is not None:
        diary.title = body.title
    # body.title이 None이 아닐 때만 수정. None이면 기존 title 그대로 유지
    # 예: {"title": "새 제목"} → title만 수정, content는 그대로

    if body.content is not None:
        diary.content = body.content
        # 내용이 바뀌었으면 감정 분석 재실행
        try:
            emotion_result = analyze_emotion(body.content)
            diary.emotion_tags = emotion_result.get("emotion_tags")
            diary.emotion_score = emotion_result.get("emotion_score")
            diary.solution = None  # 내용 변경 시 기존 솔루션 초기화
        except Exception:
            pass

    db.commit()            # 변경사항을 DB에 반영 (UPDATE 쿼리 실행)
    db.refresh(diary)      # DB에서 updated_at 등 갱신된 값을 다시 읽어옴

    return diary


# ── 일기 삭제 ─────────────────────────────────────────────────────────────────────
@router.delete("/{diary_id}", status_code=204)
# status_code=204: No Content. 삭제 성공 시 돌려줄 내용이 없다는 뜻. 204는 응답 바디가 없음
def delete_diary(
    diary_id: int,                                    # 삭제할 일기 ID
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary)\
        .filter(Diary.id == diary_id, Diary.user_id == current_user.id)\
        .first()
    # 삭제 전에 해당 일기가 존재하고 내 것인지 먼저 확인

    if diary is None:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다")

    db.delete(diary)
    db.commit()


# ── 맞춤 솔루션 생성 ──────────────────────────────────────────────────────────────
@router.post("/{diary_id}/solution", response_model=DiaryResponse)
def get_solution(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary)\
        .filter(Diary.id == diary_id, Diary.user_id == current_user.id)\
        .first()
    if diary is None:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다")

    # 이미 생성된 솔루션이 있으면 재사용 (AI 재호출 없이, 쿼터 소비 없음)
    if diary.solution:
        return diary

    if not diary.emotion_score or diary.emotion_score >= 3:
        raise HTTPException(status_code=400, detail="감정 점수가 낮은 일기에만 솔루션을 생성할 수 있습니다")

    # 쿼터 확인 및 소비 (무료 한도 초과 시 크레딧 차감, 크레딧도 없으면 402)
    check_and_consume(db, current_user, "solution")

    # 유저 선호도 파싱
    preferences = {}
    if current_user.preferences:
        try:
            preferences = json.loads(current_user.preferences)
        except Exception:
            preferences = {}

    try:
        solution_text = generate_solution(
            diary.content,
            diary.emotion_score,
            diary.emotion_tags or "",
            preferences
        )
        diary.solution = solution_text
        db.commit()
        db.refresh(diary)
    except Exception:
        raise HTTPException(status_code=500, detail="솔루션 생성에 실패했습니다")

    return diary
