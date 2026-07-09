from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..models.diary import Diary
from ..models.user import User
from ..schemas.diary import DiaryCreate, DiaryUpdate, DiaryResponse
from ..routers.auth import get_current_user

from ..services.groq import analyze_emotion, generate_solution
from ..services.quota import check_and_consume
import json

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
