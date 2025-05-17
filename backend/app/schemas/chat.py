# ─── 채팅 관련 요청/응답 스키마 ──────────────────────────────────────────────────

from pydantic import BaseModel   # 스키마 부모 클래스
from typing import Optional      # 있어도 되고 없어도 되는 필드에 사용
from datetime import datetime    # 메시지 전송 시각 타입


# ── 메시지 전송 요청 스키마 ───────────────────────────────────────────────────────
class ChatMessageCreate(BaseModel):
    # 프론트에서 메시지 보낼 때 전달하는 데이터
    # 예: {"content": "오늘 너무 힘들었어", "diary_id": 3}
    content: str
    diary_id: Optional[int] = None
    # AI 말투 페르소나. 없으면 기본(friend) 사용
    # friend | mentor | counselor | cheerleader | simsimi
    persona: Optional[str] = "friend"


# ── 메시지 응답 스키마 ────────────────────────────────────────────────────────────
class ChatMessageResponse(BaseModel):
    # 서버가 프론트에 메시지 하나를 돌려줄 때 사용
    id: int            # 메시지 고유 ID
    user_id: int       # 어느 유저의 메시지인지
    role: str          # "user"(내가 보낸 것) 또는 "assistant"(AI가 보낸 것)
    content: str       # 메시지 내용
    diary_id: Optional[int] = None  # 어느 일기 채팅방인지. 없으면 일반 채팅
    created_at: datetime  # 전송 시각

    class Config:
        from_attributes = True
        # SQLAlchemy ChatMessage 객체 → 이 스키마로 자동 변환 가능하게 하는 설정


# ── 채팅 전송 응답 스키마 ─────────────────────────────────────────────────────────
class ChatResponse(BaseModel):
    # 메시지 전송 후 서버가 돌려주는 응답
    # 내가 보낸 메시지 + AI 응답 메시지 둘 다 포함
    user_message: ChatMessageResponse   # 방금 내가 보낸 메시지
    ai_message: ChatMessageResponse     # AI가 답한 메시지
