# ─── 연애 상담 관련 요청/응답 스키마 ─────────────────────────────────────────────

from pydantic import BaseModel   # 스키마 부모 클래스
from typing import Optional      # 있어도 되고 없어도 되는 필드에 사용
from datetime import datetime    # 상담 생성 시각 타입


# ── 연애 상담 요청 스키마 ─────────────────────────────────────────────────────────
class ConsultCreate(BaseModel):
    # 프론트에서 상담 요청 시 보내는 데이터
    situation: str                      # 전체 상황 설명. 필수. 예: "남자친구가 연락을 안 해요"
    my_action: Optional[str] = None     # 내가 한 행동. 선택. 예: "나는 먼저 연락했어요"
    partner_action: Optional[str] = None  # 상대방이 한 행동. 선택. 예: "읽씹했어요"


# ── 연애 상담 응답 스키마 ─────────────────────────────────────────────────────────
class ConsultResponse(BaseModel):
    # 서버가 프론트에 상담 결과를 돌려줄 때 사용
    id: int                          # 상담 고유 ID
    user_id: int                     # 요청한 유저 ID
    situation: str                   # 입력한 상황
    my_action: Optional[str]         # 입력한 내 행동
    partner_action: Optional[str]    # 입력한 상대방 행동
    verdict: Optional[str]           # AI 판정 결과. 예: "상대방 잘못"
    message_script: Optional[str]    # AI가 생성한 화해 문자 스크립트
    created_at: datetime             # 상담 생성 시각

    class Config:
        from_attributes = True
        # SQLAlchemy Consultation 객체 → 이 스키마로 자동 변환 가능하게 하는 설정
