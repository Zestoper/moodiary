from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.quota import UsageQuota
from ..models.user import User

FREE_LIMITS = {
    "solution": 3,
    "consult": 5,
    "monthly_report": 1,
}

def get_quota_status(db: Session, user_id: int, feature: str) -> dict:
    """현재 사용량 조회 (소비하지 않음). 프론트 UI에서 남은 횟수 표시용"""
    now = datetime.now()
    quota = db.query(UsageQuota).filter(
        UsageQuota.user_id == user_id,
        UsageQuota.feature == feature,
        UsageQuota.year == now.year,
        UsageQuota.month == now.month,
    ).first()

    used = quota.count if quota else 0
    limit = FREE_LIMITS.get(feature, 0)
    return {
        "feature": feature,
        "used": used,
        "limit": limit,
        "remaining_free": max(0, limit - used),
    }

def check_and_consume(db: Session, user: User, feature: str) -> None:
    """
    무료 쿼터가 남아있으면 1 소비.
    무료 쿼터 소진 시 크레딧 1 차감.
    둘 다 없으면 HTTP 402 에러 발생.
    """
    now = datetime.now()
    limit = FREE_LIMITS.get(feature, 0)

    quota = db.query(UsageQuota).filter(
        UsageQuota.user_id == user.id,
        UsageQuota.feature == feature,
        UsageQuota.year == now.year,
        UsageQuota.month == now.month,
    ).first()

    used = quota.count if quota else 0

    if used < limit:

        if quota is None:
            quota = UsageQuota(
                user_id=user.id,
                feature=feature,
                year=now.year,
                month=now.month,
                count=1,
            )
            db.add(quota)
        else:
            quota.count += 1
        db.commit()
        return

    if user.credits < 1:

        raise HTTPException(
            status_code=402,
            detail={
                "message": "이번 달 무료 횟수를 모두 사용했어요. 크레딧을 충전하면 계속 이용할 수 있어요.",
                "feature": feature,
                "used": used,
                "limit": limit,
            },
        )

    user.credits -= 1
    if quota is None:
        quota = UsageQuota(
            user_id=user.id,
            feature=feature,
            year=now.year,
            month=now.month,
            count=used + 1,
        )
        db.add(quota)
    else:
        quota.count += 1
    db.commit()
    db.refresh(user)
