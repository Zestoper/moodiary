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

    check_and_consume(db, current_user, "monthly_report")

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
