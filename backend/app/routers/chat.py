# ─── AI 채팅 API 엔드포인트 (채팅 내역 조회 / 메시지 전송) ──────────────────────

import json
import traceback
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from ..core.database import get_db, SessionLocal        # DB 세션 생성 함수 + 세션 클래스
from ..models.chat import ChatMessage                   # ChatMessage ORM 모델. chat_messages 테이블과 연결
from ..models.diary import Diary                        # 일기 컨텍스트 조회용
from ..models.user import User                          # 현재 유저 타입
from ..schemas.chat import ChatMessageCreate, ChatMessageResponse, ChatResponse  # 스키마
from ..routers.auth import get_current_user             # 로그인된 유저 가져오는 의존성 함수
from ..services.groq import chat_with_ai, chat_with_ai_stream  # 일반/스트리밍 AI 채팅 함수

router = APIRouter()  # main.py에서 prefix="/api/chat" 으로 등록됨


# ── 채팅 내역 조회 ────────────────────────────────────────────────────────────────
@router.get("/history", response_model=List[ChatMessageResponse])
# List[ChatMessageResponse]: 메시지 여러 개를 리스트로 반환
def get_chat_history(
    diary_id: Optional[int] = Query(None),
    # diary_id: 일기 채팅방 ID. 있으면 해당 일기 채팅만, 없으면 일반 채팅(diary_id=NULL)만 반환
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # 비로그인이면 401 에러
):
    query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)

    if diary_id is not None:
        query = query.filter(ChatMessage.diary_id == diary_id)
    else:
        query = query.filter(ChatMessage.diary_id == None)  # noqa: E711
        # diary_id가 없으면 일반 채팅(NULL)만 보여줌. is_(None)은 SQLAlchemy ORM에서 == None과 동일

    return query.order_by(ChatMessage.created_at.asc()).all()


# ── 메시지 전송 ───────────────────────────────────────────────────────────────────
@router.post("/send", response_model=ChatResponse, status_code=201)
def send_message(
    body: ChatMessageCreate,                            # 사용자 메시지 + 선택적 diary_id
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ── 1. 일기 컨텍스트 준비 ──────────────────────────────────────────────────────
    diary_context = ""  # AI에게 넘길 일기 내용. 기본값은 빈 문자열

    if body.diary_id:
        # diary_id가 있으면 해당 일기를 DB에서 찾아서 AI에게 맥락으로 제공
        diary = db.query(Diary)\
            .filter(Diary.id == body.diary_id, Diary.user_id == current_user.id)\
            .first()
        # 내 일기인지 확인하면서 조회. 없거나 남의 일기면 None
        if diary:
            diary_context = diary.content
            # 일기 본문을 AI에게 넘겨서 "이 일기 쓴 사람이랑 대화 중"이라는 맥락 제공

    # ── 2. 이전 대화 내역 불러오기 ────────────────────────────────────────────────
    previous_messages = db.query(ChatMessage)\
        .filter(ChatMessage.user_id == current_user.id)\
        .order_by(ChatMessage.created_at.asc())\
        .limit(20)\
        .all()
    # 최근 20개까지만 불러옴. 너무 많으면 AI API 토큰 초과 가능
    # AI는 이 대화 내역을 보고 맥락 있는 답변을 할 수 있음

    messages_for_ai = [
        {"role": msg.role, "content": msg.content}
        for msg in previous_messages
    ]
    # DB의 ChatMessage 객체 리스트 → AI가 받을 수 있는 dict 리스트로 변환
    # 예: [{"role": "user", "content": "안녕"}, {"role": "assistant", "content": "안녕!"}]

    messages_for_ai.append({"role": "user", "content": body.content})
    # 방금 사용자가 보낸 새 메시지를 맨 뒤에 추가

    # ── 3. AI 응답 생성 ────────────────────────────────────────────────────────────
    ai_response_text = chat_with_ai(messages_for_ai, diary_context)
    # Groq AI에 대화 내역 전체를 보내서 응답 받아옴

    # ── 4. 두 메시지 모두 DB에 저장 ───────────────────────────────────────────────
    user_msg = ChatMessage(
        user_id=current_user.id,
        role="user",           # 내가 보낸 메시지
        content=body.content   # 사용자가 입력한 텍스트
    )
    ai_msg = ChatMessage(
        user_id=current_user.id,
        role="assistant",         # AI가 보낸 메시지
        content=ai_response_text  # Groq이 생성한 응답 텍스트
    )

    db.add(user_msg)   # 사용자 메시지 저장 준비
    db.add(ai_msg)     # AI 메시지 저장 준비
    db.commit()        # 두 메시지 동시에 DB에 INSERT
    db.refresh(user_msg)  # DB에서 id, created_at 등 갱신된 값 읽어옴
    db.refresh(ai_msg)    # AI 메시지도 동일하게 갱신

    return ChatResponse(
        user_message=user_msg,  # 내가 보낸 메시지 객체
        ai_message=ai_msg       # AI 응답 메시지 객체
    )
    # 프론트는 이 응답을 받아서 채팅창에 두 말풍선을 동시에 추가


# ── 채팅 전체 삭제 (대화 초기화) ────────────────────────────────────────────────
@router.delete("/history", status_code=204)
# status_code=204: 성공했지만 반환할 내용 없음 (No Content). 삭제 API의 표준 응답 코드
def clear_chat_history(
    diary_id: Optional[int] = Query(None),
    # diary_id: 있으면 해당 일기 채팅방만 삭제, 없으면 일반 채팅(NULL)만 삭제
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # 비로그인이면 401 에러
):
    query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)

    if diary_id is not None:
        query = query.filter(ChatMessage.diary_id == diary_id)
    else:
        query = query.filter(ChatMessage.diary_id == None)  # noqa: E711

    query.delete()
    db.commit()
    # DELETE 쿼리 실제 실행. commit() 호출 전까지는 DB에 반영 안 됨

    return
    # 204 응답 → 반환 데이터 없음. 프론트에서는 응답 body 없이 성공 여부만 확인


# ── 스트리밍 채팅 (SSE) ────────────────────────────────────────────────────────────
# SSE(Server-Sent Events): 서버가 클라이언트로 데이터를 실시간으로 조금씩 밀어주는 방식
# AI 응답이 타이핑되듯 글자 단위로 화면에 나타나는 효과
@router.post("/stream")
def stream_message(
    body: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ── 1. 일기 컨텍스트 준비 ─────────────────────────────────────────────────────
    diary_context = ""
    if body.diary_id:
        diary = db.query(Diary)\
            .filter(Diary.id == body.diary_id, Diary.user_id == current_user.id)\
            .first()
        if diary:
            diary_context = diary.content

    # ── 2. 이전 대화 내역 준비 (같은 diary_id 채팅방만) ────────────────────────
    prev_query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)
    if body.diary_id is not None:
        prev_query = prev_query.filter(ChatMessage.diary_id == body.diary_id)
    else:
        prev_query = prev_query.filter(ChatMessage.diary_id == None)  # noqa: E711

    previous_messages = prev_query.order_by(ChatMessage.created_at.asc()).limit(20).all()

    messages_for_ai = [{"role": m.role, "content": m.content} for m in previous_messages]
    messages_for_ai.append({"role": "user", "content": body.content})

    # ── 3. 유저 메시지 먼저 DB에 저장 ────────────────────────────────────────────
    user_msg = ChatMessage(user_id=current_user.id, role="user", content=body.content, diary_id=body.diary_id)
    # diary_id: 일기에서 채팅을 시작한 경우 해당 일기 ID. 없으면 NULL (일반 채팅)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    user_msg_id = user_msg.id    # 스트리밍 제너레이터 안에서 db 세션을 쓸 수 없으므로 미리 저장
    user_id = current_user.id    # 제너레이터 클로저에서 사용
    diary_id_for_gen = body.diary_id  # 제너레이터 클로저에서 AI 메시지에도 같은 diary_id 저장

    def generate():
        # 제너레이터 함수: yield로 데이터를 조금씩 반환
        full_response = []  # 스트리밍이 끝난 후 전체 응답을 DB에 저장하기 위해 조각 모음

        try:
            for chunk_text in chat_with_ai_stream(messages_for_ai, diary_context, body.persona or "friend"):
                full_response.append(chunk_text)
                # SSE 형식: "data: {JSON}\n\n". 브라우저/fetch가 이 형식을 파싱함
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk_text})}\n\n"
        except Exception as e:
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': f'AI 응답 실패: {str(e)}'})}\n\n"
            return

        # ── 4. AI 전체 응답 DB에 저장 ────────────────────────────────────────────
        ai_response_text = "".join(full_response)
        # 스트리밍 종료 후 새 DB 세션을 열어서 저장
        # 기존 db 세션은 제너레이터 바깥에서 생성됐기 때문에 여기서 쓰면 안 됨
        new_db = SessionLocal()
        try:
            ai_msg = ChatMessage(
                user_id=user_id,
                role="assistant",
                content=ai_response_text,
                diary_id=diary_id_for_gen  # 유저 메시지와 같은 diary_id로 저장
            )
            new_db.add(ai_msg)
            new_db.commit()
            new_db.refresh(ai_msg)
            # 완료 이벤트: 실제 DB id 전달. 프론트에서 임시 id를 진짜 id로 교체
            yield f"data: {json.dumps({'type': 'done', 'user_msg_id': user_msg_id, 'ai_msg_id': ai_msg.id})}\n\n"
        finally:
            new_db.close()  # 반드시 닫아야 DB 커넥션 누수 없음

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",   # SSE 미디어 타입
        headers={
            "Cache-Control": "no-cache",  # 브라우저가 응답을 캐싱하지 않게
            "X-Accel-Buffering": "no",    # Nginx 프록시 버퍼링 비활성화 (배포 시 필요)
        }
    )
