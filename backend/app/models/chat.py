from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey  # 필요한 컬럼 타입들
from sqlalchemy.sql import func                                              # SQL 함수 (현재 시각 등)
from sqlalchemy.orm import relationship                                      # 테이블 간 관계 정의
from ..core.database import Base                                             # 모든 모델의 부모 클래스


class ChatMessage(Base):
    __tablename__ = "chat_messages"  # MySQL에서 생성될 테이블 이름

    id = Column(Integer, primary_key=True, index=True)  # 메시지 고유 ID. 자동 증가
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # 어느 유저의 메시지인지
    # role: 메시지를 보낸 주체. "user"(사람이 보낸 메시지) 또는 "assistant"(Claude가 보낸 메시지)
    # 채팅 기록을 Claude에 다시 보낼 때 이 role 값을 그대로 사용함
    role = Column(String(20), nullable=False)   # "user" 또는 "assistant"
    content = Column(Text, nullable=False)      # 실제 메시지 내용. 길 수 있으므로 Text 타입
    diary_id = Column(Integer, ForeignKey("diaries.id", ondelete="SET NULL"), nullable=True)
    # diary_id: 어느 일기 채팅방인지. NULL이면 일반 채팅 (일기 없이 시작한 대화)
    # ondelete="SET NULL": 일기 삭제 시 채팅은 남기되 diary_id만 NULL로 바꿈
    created_at = Column(DateTime, server_default=func.now())  # 메시지 전송 시각. 자동 입력

    # relationship: chat_message.user 로 연결된 User 객체에 바로 접근 가능
    # backref="chat_messages": user.chat_messages 로 유저의 채팅 목록도 접근 가능
    user = relationship("User", backref="chat_messages")
