# ─── 월간 감정 리포트 API ──────────────────────────────────────────────────────────
# 해당 월의 일기 목록을 Groq AI에 보내 서술형 감정 리포트 생성

import calendar
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.diary import Diary
from ..models.user import User
from ..routers.auth import get_current_user
from ..services.groq import generate_monthly_report
from ..services.quota import check_and_consume

router = APIRouter()


@router.get("/monthly")
def monthly_report(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 해당 월의 첫날~마지막 날 범위 계산
    _, last_day = calendar.monthrange(year, month)
    start = datetime(year, month, 1)
    end = datetime(year, month, last_day, 23, 59, 59)

    diaries = (
        db.query(Diary)
        .filter(
            Diary.user_id == current_user.id,
            Diary.created_at >= start,
            Diary.created_at <= end,
        )
        .order_by(Diary.created_at)
        .all()
    )

    if not diaries:
        return {"report": None, "diary_count": 0}

    # 쿼터 확인 및 소비 (무료 한도 초과 시 크레딧 차감, 크레딧도 없으면 402)
    check_and_consume(db, current_user, "monthly_report")

    # Groq에 넘길 형태로 변환. 본문은 150자 제한 (API 토큰 절약)
    diary_data = [
        {
            "date": d.created_at.strftime("%Y-%m-%d"),
            "title": d.title,
            "content": d.content[:150],
            "emotion_tags": d.emotion_tags,
            "emotion_score": d.emotion_score,
        }
        for d in diaries
    ]

    report_text = generate_monthly_report(diary_data, year, month)
    return {"report": report_text, "diary_count": len(diaries)}
