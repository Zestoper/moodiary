# 이 스크립트를 한 번 실행하면 MySQL에 모든 테이블이 자동으로 생성됨
# 실행 방법: python init_db.py (backend 폴더에서)
from app.core.database import engine, Base

# 모든 모델을 임포트해야 Base가 테이블 정보를 인식할 수 있음
from app.models import User, Diary, ChatMessage, Consultation

# create_all: Base를 상속받은 모든 모델 클래스를 스캔해서 DB에 테이블을 생성
# checkfirst=True(기본값): 이미 테이블이 있으면 건너뜀. 기존 데이터 삭제 안 함
Base.metadata.create_all(bind=engine)

print("테이블 생성 완료!")
print("생성된 테이블: users, diaries, chat_messages, consultations")
