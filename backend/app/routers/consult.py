# ─── 연애 상담 API 엔드포인트 (상담 요청 / 목록 조회 / 상세 조회) ─────────────────

from fastapi import APIRouter, Depends, HTTPException  # 라우터, 의존성 주입, 에러 처리
from sqlalchemy.orm import Session                      # DB 세션 타입
from typing import List                                 # 리스트 타입 힌트

from ..core.database import get_db                           # DB 세션 생성 함수
from ..models.consultation import Consultation               # Consultation ORM 모델. consultations 테이블과 연결
from ..models.user import User                               # 현재 유저 타입
from ..schemas.consult import ConsultCreate, ConsultResponse # 요청/응답 스키마
from ..routers.auth import get_current_user                  # 로그인된 유저 가져오는 의존성 함수
from ..services.groq import analyze_relationship             # Groq AI 연애 상담 호출 함수
from ..services.quota import check_and_consume               # 쿼터 확인 및 소비

router = APIRouter()  # main.py에서 prefix="/api/consult" 로 등록됨


# ── 연애 상담 요청 ─────────────────────────────────────────────────────────────────
@router.post("/", response_model=ConsultResponse, status_code=201)
def create_consultation(
    body: ConsultCreate,                              # 상황, 내 행동, 상대방 행동을 받음
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)   # 비로그인이면 401 에러
):
    # 쿼터 확인 및 소비 (무료 한도 초과 시 크레딧 차감, 크레딧도 없으면 402)
    check_and_consume(db, current_user, "consult")

    # ── 1. Groq AI에 상담 요청 ────────────────────────────────────────────────────
    verdict = None        # 판정 결과. AI 호출 실패해도 저장은 되게 None으로 초기화
    message_script = None # 화해 문자. AI 호출 실패해도 저장은 되게 None으로 초기화

    try:
        result = analyze_relationship(
            situation=body.situation,
            my_action=body.my_action or "",       # None이면 빈 문자열로 변환해서 전달
            partner_action=body.partner_action or ""  # None이면 빈 문자열로 변환해서 전달
        )
        verdict = result.get("verdict")           # AI 판정 결과. 예: "상대방 잘못"
        message_script = result.get("message_script")  # AI 화해 문자. 예: "자기야, 많이 서운했어..."
    except Exception:
        pass
        # AI 호출 실패해도 상담 내용은 DB에 저장됨. verdict, message_script는 None

    # ── 2. DB에 상담 저장 ─────────────────────────────────────────────────────────
    new_consult = Consultation(
        user_id=current_user.id,          # 현재 로그인된 유저 ID
        situation=body.situation,          # 입력한 상황 설명
        my_action=body.my_action,          # 입력한 내 행동 (없으면 None)
        partner_action=body.partner_action, # 입력한 상대방 행동 (없으면 None)
        verdict=verdict,                   # AI 판정 결과
        message_script=message_script      # AI 화해 문자
    )

    db.add(new_consult)       # DB 세션에 추가
    db.commit()               # DB에 INSERT 쿼리 실행
    db.refresh(new_consult)   # id, created_at 등 갱신된 값 읽어옴

    return new_consult


# ── 연애 상담 목록 조회 ────────────────────────────────────────────────────────────
@router.get("/", response_model=List[ConsultResponse])
# List[ConsultResponse]: 상담 여러 개를 리스트로 반환
def get_consultations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consultations = db.query(Consultation)\
        .filter(Consultation.user_id == current_user.id)\
        .order_by(Consultation.created_at.desc())\
        .all()
    # 내 상담 목록만 최신순으로 조회

    return consultations


# ── 연애 상담 상세 조회 ────────────────────────────────────────────────────────────
@router.get("/{consult_id}", response_model=ConsultResponse)
def get_consultation(
    consult_id: int,                               # URL에서 받은 상담 ID. 예: /api/consult/3 → 3
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    consult = db.query(Consultation)\
        .filter(
            Consultation.id == consult_id,
            Consultation.user_id == current_user.id  # 내 상담인지 확인
        ).first()

    if consult is None:
        raise HTTPException(status_code=404, detail="상담 내역을 찾을 수 없습니다")

    return consult


# ── 연애 상담 삭제 ─────────────────────────────────────────────────────────────────
@router.delete("/{consult_id}", status_code=204)
# status_code=204: 삭제 성공, 반환 데이터 없음 (No Content)
def delete_consultation(
    consult_id: int,                               # URL에서 받은 상담 ID. 예: /api/consult/3 → 3
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # 비로그인이면 401 에러
):
    consult = db.query(Consultation)\
        .filter(
            Consultation.id == consult_id,
            Consultation.user_id == current_user.id  # 내 상담인지 확인. 남의 상담 삭제 방지
        ).first()

    if consult is None:
        raise HTTPException(status_code=404, detail="상담 내역을 찾을 수 없습니다")
        # 없는 상담이거나 다른 사람 상담이면 404 에러

    db.delete(consult)  # 해당 상담 레코드 삭제 준비
    db.commit()         # DELETE 쿼리 실제 실행

    return
    # 204 응답 → 반환 데이터 없음
