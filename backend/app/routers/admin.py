from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import date, datetime

from ..core.database import get_db
from ..models.diary import Diary
from ..models.payment import Payment
from ..models.quota import UsageQuota
from ..models.user import User
from ..routers.auth import get_current_user

router = APIRouter()

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """is_admin=True가 아니면 403 에러 발생. 모든 관리자 엔드포인트에 Depends로 주입"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")
    return current_user

class GrantCreditsRequest(BaseModel):
    user_id: int
    credits: int

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """대시보드 요약 통계: 총 유저 수, 오늘 신규 가입, 총 일기 수, 총 수익, AI 사용 횟수"""
    today_start = datetime.combine(date.today(), datetime.min.time())

    total_users = db.query(func.count(User.id)).scalar()
    new_today = db.query(func.count(User.id)).filter(User.created_at >= today_start).scalar()
    total_diaries = db.query(func.count(Diary.id)).scalar()
    total_revenue = db.query(func.sum(Payment.amount)).filter(Payment.status == "paid").scalar() or 0
    total_ai_uses = db.query(func.sum(UsageQuota.count)).scalar() or 0

    return {
        "total_users": total_users,
        "new_today": new_today,
        "total_diaries": total_diaries,
        "total_revenue": total_revenue,
        "total_ai_uses": total_ai_uses,
    }

@router.get("/users")
def get_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """유저 목록. 각 유저의 일기 수와 함께 반환"""

    diary_counts = (
        db.query(Diary.user_id, func.count(Diary.id).label("diary_count"))
        .group_by(Diary.user_id)
        .subquery()
    )

    results = (
        db.query(
            User.id,
            User.email,
            User.username,
            User.credits,
            User.is_admin,
            User.created_at,
            func.coalesce(diary_counts.c.diary_count, 0).label("diary_count"),
        )
        .outerjoin(diary_counts, User.id == diary_counts.c.user_id)
        .order_by(User.created_at.desc())
        .all()
    )

    return {
        "users": [
            {
                "id": r.id,
                "email": r.email,
                "username": r.username,
                "credits": r.credits,
                "is_admin": r.is_admin,
                "diary_count": r.diary_count,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in results
        ]
    }

@router.get("/ai-usage")
def get_ai_usage(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """이번 달 기능별 AI 사용량 집계"""
    now = datetime.now()
    results = (
        db.query(UsageQuota.feature, func.sum(UsageQuota.count).label("total"))
        .filter(UsageQuota.year == now.year, UsageQuota.month == now.month)
        .group_by(UsageQuota.feature)
        .all()
    )

    usage_map = {r.feature: r.total for r in results}
    return {
        "year": now.year,
        "month": now.month,
        "usage": {
            "solution": usage_map.get("solution", 0),
            "consult": usage_map.get("consult", 0),
            "monthly_report": usage_map.get("monthly_report", 0),
        },
    }

@router.get("/payments")
def get_all_payments(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """최근 100건 결제 내역 (유저 이메일 포함)"""
    results = (
        db.query(Payment, User.email, User.username)
        .join(User, Payment.user_id == User.id)
        .order_by(Payment.created_at.desc())
        .limit(100)
        .all()
    )

    return {
        "payments": [
            {
                "id": p.id,
                "user_email": email,
                "username": username,
                "amount": p.amount,
                "credits": p.credits,
                "status": p.status,
                "imp_uid": p.imp_uid,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p, email, username in results
        ]
    }

@router.post("/credits")
def grant_credits(
    body: GrantCreditsRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """관리자가 특정 유저에게 크레딧 수동 지급"""
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

    user.credits += body.credits
    db.commit()

    return {
        "success": True,
        "user_id": user.id,
        "credits_granted": body.credits,
        "total_credits": user.credits,
    }
