# ─── 크레딧 충전 결제 API (PortOne / 아임포트) ───────────────────────────────────
# 패키지 목록 조회 / 결제 검증 및 크레딧 지급 / 결제 내역 조회

import uuid
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from ..core.config import settings
from ..core.database import get_db
from ..models.payment import Payment
from ..models.user import User
from ..routers.auth import get_current_user

router = APIRouter()

# 크레딧 패키지 목록. 금액(amount)과 지급 크레딧(credits) 쌍
PACKAGES = [
    {"id": "credits_5",  "credits": 5,  "amount": 1500, "label": "5 크레딧"},
    {"id": "credits_10", "credits": 10, "amount": 2900, "label": "10 크레딧"},
    {"id": "credits_30", "credits": 30, "amount": 7900, "label": "30 크레딧"},
]


# ── 결제 검증 요청 바디 스키마 ─────────────────────────────────────────────────────
class VerifyPaymentRequest(BaseModel):
    imp_uid: str       # PortOne이 발급한 결제 고유 ID. 클라이언트에서 결제 완료 후 전달
    merchant_uid: str  # 우리 서버가 생성한 주문 ID. 클라이언트가 결제 전 생성해서 전달
    package_id: str    # 어떤 패키지를 구매했는지. 예: "credits_10"


# ── 크레딧 수동 지급 요청 바디 스키마 (관리자용) ──────────────────────────────────
class GrantCreditsRequest(BaseModel):
    user_id: int    # 크레딧을 지급할 유저 ID
    credits: int    # 지급할 크레딧 수


def _get_portone_token() -> Optional[str]:
    """PortOne REST API 접근 토큰을 발급받아 반환. 실패 시 None"""
    try:
        resp = requests.post(
            "https://api.iamport.kr/users/getToken",
            json={
                "imp_key": settings.PORTONE_IMP_KEY,
                "imp_secret": settings.PORTONE_IMP_SECRET,
            },
            timeout=5,
        )
        return resp.json()["response"]["access_token"]
    except Exception:
        return None


def _verify_imp_uid(imp_uid: str, expected_amount: int) -> bool:
    """PortOne 서버에서 결제 정보를 조회해 금액이 일치하는지 검증"""
    token = _get_portone_token()
    if not token:
        return False
    try:
        resp = requests.get(
            f"https://api.iamport.kr/payments/{imp_uid}",
            headers={"Authorization": token},
            timeout=5,
        )
        data = resp.json().get("response", {})
        # 결제 상태가 'paid'이고 금액이 예상과 일치해야 통과
        return data.get("status") == "paid" and data.get("amount") == expected_amount
    except Exception:
        return False


@router.get("/packages")
def get_packages():
    """크레딧 패키지 목록 반환. 로그인 불필요"""
    return {"packages": PACKAGES}


@router.post("/verify")
def verify_payment(
    body: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    결제 검증 후 크레딧 지급.
    PortOne 키가 설정되어 있으면 실제 검증, 없으면 테스트 모드(크레딧만 지급).
    """
    # 패키지 ID 확인
    package = next((p for p in PACKAGES if p["id"] == body.package_id), None)
    if not package:
        raise HTTPException(status_code=400, detail="유효하지 않은 패키지입니다")

    # 중복 결제 방지: 같은 imp_uid로 이미 처리된 결제가 있으면 거절
    existing = db.query(Payment).filter(Payment.imp_uid == body.imp_uid).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 처리된 결제입니다")

    # PortOne 검증 여부 결정
    portone_configured = bool(
        settings.PORTONE_IMP_KEY and settings.PORTONE_IMP_SECRET
        and settings.PORTONE_IMP_KEY != "your_imp_key_here"
    )

    if portone_configured:
        # 실제 결제 검증
        if not _verify_imp_uid(body.imp_uid, package["amount"]):
            raise HTTPException(status_code=400, detail="결제 검증에 실패했습니다")
        status = "paid"
    else:
        # 테스트 모드: 검증 없이 크레딧 지급
        status = "test"

    # 결제 기록 저장
    payment = Payment(
        user_id=current_user.id,
        imp_uid=body.imp_uid,
        merchant_uid=body.merchant_uid,
        amount=package["amount"],
        credits=package["credits"],
        status=status,
    )
    db.add(payment)

    # 크레딧 지급
    current_user.credits += package["credits"]
    db.commit()

    return {
        "success": True,
        "credits_granted": package["credits"],
        "total_credits": current_user.credits,
        "status": status,
    }


@router.get("/history")
def get_payment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """내 결제 내역 조회. 최신순"""
    payments = (
        db.query(Payment)
        .filter(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .all()
    )
    return {
        "payments": [
            {
                "id": p.id,
                "imp_uid": p.imp_uid,
                "amount": p.amount,
                "credits": p.credits,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payments
        ]
    }
