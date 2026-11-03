import calendar
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.timeutil import kst_date, kst_to_utc_naive
from ..models.diary import Diary
from ..models.user import User
from ..routers.auth import get_current_user
from ..services.groq import generate_monthly_report, generate_recap_line
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
    # 한국 시간 기준 그 달 1일 0시 ~ 말일 23:59:59 를 DB(UTC) 시각으로 바꿔 비교
    start = kst_to_utc_naive(datetime(year, month, 1))
    end = kst_to_utc_naive(datetime(year, month, last_day, 23, 59, 59))

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
            "date": kst_date(d.created_at).isoformat(),
            "title": d.title,
            "content": d.content[:150],
            "emotion_tags": d.emotion_tags,
            "emotion_score": d.emotion_score,
        }
        for d in diaries
    ]

    report_text = generate_monthly_report(diary_data, year, month)
    return {"report": report_text, "diary_count": len(diaries)}


# ── 감정 결산 (월간 · 연간 카드) ─────────────────────────────────────────────────
# 숫자는 전부 코드로 계산하고(AI 추측 없음) 마지막 한 줄 총평만 AI가 쓴다.

WEATHER_GROUPS = [   # Open-Meteo WMO 날씨 코드 → 묶음
    ("맑음", range(0, 1)), ("구름", range(1, 4)), ("안개", range(45, 49)),
    ("비", list(range(51, 68)) + list(range(80, 83))), ("눈", list(range(71, 78)) + [85, 86]), ("뇌우", range(95, 100)),
]
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]
# DB 시각(세션 시간대 기준)을 한국 시각으로 — 새벽에 쓴 일기가 전날로 묶이지 않게
_KST_SQL = "((created_at AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Seoul')"


def _weather_name(code: Optional[int]) -> Optional[str]:
    if code is None:
        return None
    for name, codes in WEATHER_GROUPS:
        if code in codes:
            return name
    return None


def _avg(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), 1) if xs else None


def _longest_streak(days: list[date]) -> int:
    best = cur = 0
    prev = None
    for d in sorted(set(days)):
        cur = cur + 1 if prev and d - prev == timedelta(days=1) else 1
        best = max(best, cur)
        prev = d
    return best


@router.get("/recap")
def emotion_recap(
    year: int,
    month: Optional[int] = None,     # 없으면 연간 결산
    with_ai: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if month is not None and not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="month는 1~12")
    start = datetime(year, month or 1, 1)
    end = datetime(year + (1 if not month or month == 12 else 0), 1 if not month or month == 12 else month + 1, 1)

    rows = db.execute(text(f"""
        SELECT id, title, emotion_tags, emotion_score, weather_code, temperature, {_KST_SQL} AS kst
        FROM diaries
        WHERE user_id = :uid AND {_KST_SQL} >= :start AND {_KST_SQL} < :end
        ORDER BY kst
    """), {"uid": current_user.id, "start": start, "end": end}).fetchall()

    period = f"{year}년 {month}월" if month else f"{year}년"
    if not rows:
        return {"period": period, "count": 0}

    scores = [r.emotion_score for r in rows if r.emotion_score]
    tags = Counter(t.strip() for r in rows for t in (r.emotion_tags or "").split(",") if t.strip())
    total_tags = sum(tags.values()) or 1
    scored = [r for r in rows if r.emotion_score]
    best = max(scored, key=lambda r: (r.emotion_score, r.kst)) if scored else None
    worst = min(scored, key=lambda r: (r.emotion_score, r.kst)) if scored else None

    # 흐름: 월간은 날짜별 평균 / 연간은 월별 평균
    buckets: dict[int, list] = {}
    for r in scored:
        buckets.setdefault(r.kst.day if month else r.kst.month, []).append(r.emotion_score)
    trend = [{"x": k, "score": _avg(v)} for k, v in sorted(buckets.items())]

    weather: dict[str, list] = {}
    for r in scored:
        name = _weather_name(r.weather_code)
        if name:
            weather.setdefault(name, []).append(r.emotion_score)
    weather_stats = sorted(
        [{"weather": k, "avg": _avg(v), "count": len(v)} for k, v in weather.items()],
        key=lambda w: -(w["avg"] or 0),
    )

    weekday: dict[int, list] = {}
    for r in scored:
        weekday.setdefault(r.kst.weekday(), []).append(r.emotion_score)
    weekday_stats = [{"weekday": WEEKDAYS[k], "avg": _avg(v), "count": len(v)} for k, v in sorted(weekday.items())]

    def day_card(r):
        return {"diary_id": r.id, "title": r.title, "date": r.kst.strftime("%Y-%m-%d"), "score": r.emotion_score,
                "tags": r.emotion_tags}

    result = {
        "period": period,
        "count": len(rows),
        "days_written": len({r.kst.date() for r in rows}),
        "longest_streak": _longest_streak([r.kst.date() for r in rows]),
        "avg_score": _avg(scores),
        "top_emotions": [{"tag": t, "count": c, "percent": round(c * 100 / total_tags)} for t, c in tags.most_common(5)],
        "best_day": day_card(best) if best else None,
        "hardest_day": day_card(worst) if worst and worst is not best else None,
        "trend": trend,
        "weather": weather_stats,
        "weekday": weekday_stats,
        "best_weekday": max(weekday_stats, key=lambda w: w["avg"] or 0)["weekday"] if weekday_stats else None,
        "ai_line": None,
    }
    if with_ai and len(rows) >= 3:
        try:
            result["ai_line"] = generate_recap_line(result)
        except Exception as e:
            print(f"[결산] AI 총평 실패 {type(e).__name__}: {str(e)[:120]}")
    return result
