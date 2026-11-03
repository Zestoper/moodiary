from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..models.chat import ChatMessage
from ..models.diary import Diary
from ..models.user import User
from ..schemas.diary import DiaryCreate, DiaryUpdate, DiaryResponse
from ..routers.auth import get_current_user

from ..services.groq import analyze_emotion, generate_solution
from ..services.quota import check_and_consume
import json
from ..services.memory import build_memory_in_background

router = APIRouter()

@router.get("/", response_model=List[DiaryResponse])

def get_diaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diaries = db.query(Diary)\
        .filter(Diary.user_id == current_user.id)\
        .order_by(Diary.created_at.desc())\
        .all()

    return diaries

@router.post("/", response_model=DiaryResponse, status_code=201)

def create_diary(
    body: DiaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    emotion_tags = None
    emotion_score = None
    try:
        emotion_result = analyze_emotion(body.content)

        emotion_tags = emotion_result.get("emotion_tags")

        emotion_score = emotion_result.get("emotion_score")

    except Exception:
        pass

    new_diary = Diary(
        user_id=current_user.id,
        title=body.title,
        content=body.content,
        emotion_tags=emotion_tags,
        emotion_score=emotion_score,
        weather_code=body.weather_code,
        temperature=body.temperature,
    )

    db.add(new_diary)
    db.commit()
    db.refresh(new_diary)

    # AI 친구가 나중에 떠올릴 기억을 만들어 둔다 (응답은 기다리지 않음)
    build_memory_in_background(new_diary.id)

    return new_diary

@router.get("/{diary_id}", response_model=DiaryResponse)

def get_diary(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary)\
        .filter(Diary.id == diary_id, Diary.user_id == current_user.id)\
        .first()

    if diary is None:

        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다")

    return diary

@router.put("/{diary_id}", response_model=DiaryResponse)

def update_diary(
    diary_id: int,
    body: DiaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary)\
        .filter(Diary.id == diary_id, Diary.user_id == current_user.id)\
        .first()

    if diary is None:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다")

    if body.title is not None:
        diary.title = body.title

    if body.content is not None:
        diary.content = body.content

        try:
            emotion_result = analyze_emotion(body.content)
            diary.emotion_tags = emotion_result.get("emotion_tags")
            diary.emotion_score = emotion_result.get("emotion_score")
            diary.solution = None
        except Exception:
            pass

    db.commit()
    db.refresh(diary)

    if body.content is not None:
        build_memory_in_background(diary.id)   # 내용이 바뀌었으니 기억도 다시 만든다

    return diary

@router.delete("/{diary_id}", status_code=204)

def delete_diary(
    diary_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diary = db.query(Diary)\
        .filter(Diary.id == diary_id, Diary.user_id == current_user.id)\
        .first()

    if diary is None:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다")

    # 채팅 FK가 ON DELETE SET NULL 이라 그냥 지우면 이 일기의 대화가 diary_id=NULL(일반 채팅)로 섞여 들어갔다
    # → 일기 대화는 일기와 함께 지운다 (운영 DB 제약을 바꾸지 않고 애플리케이션에서 처리)
    db.query(ChatMessage).filter(
        ChatMessage.diary_id == diary.id, ChatMessage.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.delete(diary)
    db.commit()

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

    if diary.solution:
        return diary

    if not diary.emotion_score or diary.emotion_score >= 3:
        raise HTTPException(status_code=400, detail="감정 점수가 낮은 일기에만 솔루션을 생성할 수 있습니다")

    check_and_consume(db, current_user, "solution")

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
