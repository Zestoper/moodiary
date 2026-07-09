from app.core.database import engine, Base

from app.models import User, Diary, ChatMessage, Consultation

Base.metadata.create_all(bind=engine)

print("테이블 생성 완료!")
print("생성된 테이블: users, diaries, chat_messages, consultations")
