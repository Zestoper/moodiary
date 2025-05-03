from sqlalchemy import create_engine                      # DB와 실제로 연결하는 엔진 객체를 만드는 함수
from sqlalchemy.ext.declarative import declarative_base   # 모든 모델 클래스가 상속받을 Base 클래스를 만드는 함수
from sqlalchemy.orm import sessionmaker                    # DB 작업(쿼리/저장)에 사용하는 세션 팩토리를 만드는 함수
from .config import settings                              # .env에서 읽어온 설정값. DATABASE_URL을 여기서 가져옴

# create_engine: DATABASE_URL을 보고 어떤 DB인지 판단해서 연결을 만들어줌
# mysql+pymysql://user:pass@host:port/dbname 형식으로 연결 정보를 전달
engine = create_engine(settings.DATABASE_URL)

# sessionmaker: DB 세션을 찍어내는 공장(팩토리). 실제 세션은 SessionLocal()로 생성
# autocommit=False: db.add() 해도 db.commit() 호출 전까지 DB에 실제로 저장 안 됨. 실수 방지
# autoflush=False:  쿼리 실행 전에 자동으로 변경사항을 DB에 동기화하지 않음. 명시적 제어를 위해 False
# bind=engine:      이 세션이 위에서 만든 engine(DB 연결)을 사용하도록 연결
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# declarative_base(): SQLAlchemy ORM 모델의 부모 클래스를 생성
# models/user.py에서 class User(Base): 로 상속받으면 User 테이블이 DB에 매핑됨
Base = declarative_base()


# FastAPI의 Depends()와 함께 쓰는 DB 세션 의존성 함수
# 라우터에서 db: Session = Depends(get_db) 로 선언하면 FastAPI가 자동으로 이 함수를 실행해서 db를 주입
def get_db():
    db = SessionLocal()  # 요청마다 새로운 DB 세션 생성
    try:
        yield db         # yield: 이 시점에서 라우터 함수에 db를 넘겨줌. 함수 실행이 끝나면 아래 finally로 돌아옴
    finally:
        db.close()       # 요청이 끝나면(성공/에러 상관없이) 항상 세션을 닫아서 커넥션 풀에 반환
