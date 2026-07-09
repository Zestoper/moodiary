from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..models.consultation import Consultation
from ..models.user import User
from ..schemas.consult import ConsultCreate, ConsultResponse
from ..routers.auth import get_current_user
from ..services.groq import analyze_relationship
from ..services.quota import check_and_consume

router = APIRouter()

@router.post("/", response_model=ConsultResponse, status_code=201)
def create_consultation(
    body: ConsultCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    check_and_consume(db, current_user, "consult")

    verdict = None
    message_script = None

    try:
        result = analyze_relationship(
            situation=body.situation,
            my_action=body.my_action or "",
            partner_action=body.partner_action or ""
        )
        verdict = result.get("verdict")
        message_script = result.get("message_script")
    except Exception:
        pass

    new_consult = Consultation(
        user_id=current_user.id,
        situation=body.situation,
        my_action=body.my_action,
        partner_action=body.partner_action,
        verdict=verdict,
        message_script=message_script
    )

    db.add(new_consult)
    db.commit()
    db.refresh(new_consult)

    return new_consult

@router.get("/", response_model=List[ConsultResponse])

def get_consultations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consultations = db.query(Consultation)\
        .filter(Consultation.user_id == current_user.id)\
        .order_by(Consultation.created_at.desc())\
        .all()

    return consultations

@router.get("/{consult_id}", response_model=ConsultResponse)
def get_consultation(
    consult_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consult = db.query(Consultation)\
        .filter(
            Consultation.id == consult_id,
            Consultation.user_id == current_user.id
        ).first()

    if consult is None:
        raise HTTPException(status_code=404, detail="상담 내역을 찾을 수 없습니다")

    return consult

@router.delete("/{consult_id}", status_code=204)

def delete_consultation(
    consult_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consult = db.query(Consultation)\
        .filter(
            Consultation.id == consult_id,
            Consultation.user_id == current_user.id
        ).first()

    if consult is None:
        raise HTTPException(status_code=404, detail="상담 내역을 찾을 수 없습니다")

    db.delete(consult)
    db.commit()

    return
