import json
import traceback
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from ..core.database import get_db, SessionLocal
from ..models.chat import ChatMessage
from ..models.diary import Diary
from ..models.user import User
from ..schemas.chat import ChatMessageCreate, ChatMessageResponse, ChatResponse
from ..routers.auth import get_current_user
from ..services.groq import chat_with_ai, chat_with_ai_stream
from ..services.memory import backfill_memories, mark_follow_ups_asked, memory_prompt, memory_refs_json, recall

router = APIRouter()

@router.get("/history", response_model=List[ChatMessageResponse])

def get_chat_history(
    diary_id: Optional[int] = Query(None),

    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)

    if diary_id is not None:
        query = query.filter(ChatMessage.diary_id == diary_id)
    else:
        query = query.filter(ChatMessage.diary_id == None)

    return query.order_by(ChatMessage.created_at.asc()).all()

CONTEXT_MESSAGES = 20


def _load_chat_context(db: Session, user_id: int, diary_id: Optional[int]):
    """
    AI에 넘길 맥락을 만든다.
    - 일기 본문: 그 일기의 감정 맥락
    - 이전 대화: **같은 일기에서 나눈 대화만** (diary_id=None 이면 일반 채팅끼리만)
      일기마다 감정이 달라서 섞이면 엉뚱한 위로를 하기 때문에 대화방을 일기 단위로 나눴다
    - 최근 CONTEXT_MESSAGES 개만 (예전엔 오래된 순으로 20개를 잘라 대화가 길어지면 최근 대화를 못 봤다)
    """
    diary_context = ""
    if diary_id:
        diary = db.query(Diary).filter(Diary.id == diary_id, Diary.user_id == user_id).first()
        if diary:
            diary_context = diary.content

    q = db.query(ChatMessage).filter(ChatMessage.user_id == user_id)
    q = q.filter(ChatMessage.diary_id == diary_id) if diary_id is not None else q.filter(ChatMessage.diary_id == None)  # noqa: E711
    recent = q.order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(CONTEXT_MESSAGES).all()
    recent.reverse()   # 최신 20개를 다시 시간 순으로
    return diary_context, [{"role": m.role, "content": m.content} for m in recent]


@router.post("/send", response_model=ChatResponse, status_code=201)
def send_message(
    body: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    # 예전엔 이 API만 일기 구분 없이 모든 대화를 섞어서 보냈다 → 스트리밍 API와 같은 함수로 통일
    diary_context, messages_for_ai = _load_chat_context(db, current_user.id, body.diary_id)
    recalled = recall(db, current_user.id, f"{diary_context}\n{body.content}", body.diary_id)

    messages_for_ai.append({"role": "user", "content": body.content})

    ai_response_text = chat_with_ai(messages_for_ai, diary_context, memory_prompt(recalled))
    mark_follow_ups_asked(db, recalled)

    # 예전엔 이 API만 diary_id를 저장하지 않아서 일기 대화가 일반 채팅으로 섞였다
    user_msg = ChatMessage(
        user_id=current_user.id,
        role="user",
        content=body.content,
        diary_id=body.diary_id,
    )
    ai_msg = ChatMessage(
        user_id=current_user.id,
        role="assistant",
        content=ai_response_text,
        diary_id=body.diary_id,
        memory_refs=memory_refs_json(recalled),
    )

    db.add(user_msg)
    db.add(ai_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(ai_msg)

    return ChatResponse(
        user_message=user_msg,
        ai_message=ai_msg
    )

@router.delete("/history", status_code=204)

def clear_chat_history(
    diary_id: Optional[int] = Query(None),

    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)

    if diary_id is not None:
        query = query.filter(ChatMessage.diary_id == diary_id)
    else:
        query = query.filter(ChatMessage.diary_id == None)

    query.delete()
    db.commit()

    return

@router.post("/stream")
def stream_message(
    body: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    diary_context, messages_for_ai = _load_chat_context(db, current_user.id, body.diary_id)
    messages_for_ai.append({"role": "user", "content": body.content})

    # 예전 일기에서 지금 대화와 관련된 기억 찾기 (일기 본문 + 이번 메시지 기준)
    recalled = recall(db, current_user.id, f"{diary_context}\n{body.content}", body.diary_id)
    memory_context = memory_prompt(recalled)
    refs_json = memory_refs_json(recalled)
    mark_follow_ups_asked(db, recalled)
    backfill_memories(db, current_user.id)   # 기능 도입 전 일기들의 기억을 조금씩 채운다

    user_msg = ChatMessage(user_id=current_user.id, role="user", content=body.content, diary_id=body.diary_id)

    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    user_msg_id = user_msg.id
    user_id = current_user.id
    diary_id_for_gen = body.diary_id

    def generate():

        full_response = []

        # 어떤 기억을 떠올렸는지 먼저 알려준다 → 화면이 답장 위에 '기억' 칩으로 표시
        if refs_json:
            yield f"data: {json.dumps({'type': 'memory', 'refs': json.loads(refs_json)}, ensure_ascii=False)}\n\n"

        try:
            for chunk_text in chat_with_ai_stream(messages_for_ai, diary_context, body.persona or "friend", memory_context):
                full_response.append(chunk_text)

                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk_text})}\n\n"
        except Exception as e:
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': f'AI 응답 실패: {str(e)}'})}\n\n"
            return

        ai_response_text = "".join(full_response)

        new_db = SessionLocal()
        try:
            ai_msg = ChatMessage(
                user_id=user_id,
                role="assistant",
                content=ai_response_text,
                diary_id=diary_id_for_gen,
                memory_refs=refs_json,
            )
            new_db.add(ai_msg)
            new_db.commit()
            new_db.refresh(ai_msg)

            yield f"data: {json.dumps({'type': 'done', 'user_msg_id': user_msg_id, 'ai_msg_id': ai_msg.id})}\n\n"
        finally:
            new_db.close()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )
