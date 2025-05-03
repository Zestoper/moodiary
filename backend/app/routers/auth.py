# ─── 인증 관련 API 엔드포인트 (회원가입 / 로그인 / 내 정보 조회) ──────────────────

from fastapi import APIRouter, Depends, HTTPException, status
# APIRouter: 이 파일의 라우터 그룹 객체
# Depends: 의존성 주입. Depends(get_db) 처럼 써서 DB 세션 등을 자동으로 받아옴
# HTTPException: HTTP 에러를 발생시키는 클래스. 예: 404, 401, 400 등
# status: HTTP 상태 코드 상수 모음. status.HTTP_400_BAD_REQUEST = 400 처럼 숫자 대신 이름으로 씀

from sqlalchemy.orm import Session
# Session: SQLAlchemy DB 세션 타입. db: Session = Depends(get_db) 에서 타입 힌트로 사용

from ..core.database import get_db
# get_db: DB 세션을 만들고 요청이 끝나면 닫아주는 함수. Depends()와 함께 사용

from ..core.security import hash_password, verify_password, create_access_token
# hash_password: 평문 비밀번호 → bcrypt 해시로 변환
# verify_password: 로그인 시 입력한 비밀번호와 DB 해시값 비교
# create_access_token: 로그인 성공 시 JWT 토큰 발급

from ..models.user import User
# User: SQLAlchemy ORM 모델. DB의 users 테이블과 연결된 클래스

from typing import Optional                                         # Optional: None도 허용하는 타입 힌트
from ..schemas.user import UserRegister, UserLogin, TokenResponse, UserResponse
# UserRegister: 회원가입 요청 데이터 형태
# UserLogin: 로그인 요청 데이터 형태
# TokenResponse: 로그인 성공 응답 형태 (access_token 포함)
# UserResponse: 유저 정보 응답 형태 (비밀번호 제외)

from fastapi.security import OAuth2PasswordBearer
# OAuth2PasswordBearer: 요청 헤더의 "Authorization: Bearer <토큰>" 에서 토큰만 꺼내주는 유틸리티

from ..core.security import decode_access_token
# decode_access_token: JWT 토큰을 해석해서 유저 ID를 꺼내는 함수


router = APIRouter()  # 이 파일의 라우터. main.py에서 prefix="/api/auth" 로 등록됨

# tokenUrl: 토큰을 발급받는 엔드포인트 경로. /docs 페이지에서 자동 인증 UI에 사용됨
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
# 이 객체를 Depends()에 넣으면 요청 헤더에서 Bearer 토큰을 자동으로 꺼내줌
# 예: Authorization: Bearer eyJhbG... → oauth2_scheme이 "eyJhbG..." 문자열만 추출


# ── 공통 의존성 함수: 현재 로그인된 유저 가져오기 ─────────────────────────────────
def get_current_user(
    token: str = Depends(oauth2_scheme),  # 헤더에서 JWT 토큰 자동 추출
    db: Session = Depends(get_db)         # DB 세션 자동 주입
) -> User:
    # 이 함수를 Depends()로 쓰면 해당 엔드포인트는 로그인한 유저만 접근 가능해짐
    # 토큰이 없거나 잘못됐으면 401 에러를 자동으로 반환

    user_id = decode_access_token(token)
    # 토큰을 해석해서 유저 ID를 꺼냄. 위조/만료된 토큰이면 None 반환

    if user_id is None:
        # None이면 토큰이 유효하지 않다는 뜻 → 401 Unauthorized 에러 발생
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,     # 401: 인증 실패
            detail="토큰이 유효하지 않습니다",              # 에러 메시지
            headers={"WWW-Authenticate": "Bearer"},        # 클라이언트에게 Bearer 토큰으로 인증하라고 안내
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    # db.query(User): users 테이블 전체를 조회하는 쿼리 시작
    # .filter(User.id == int(user_id)): WHERE id = 유저ID 조건 추가
    # .first(): 조건에 맞는 첫 번째 결과만 가져옴. 없으면 None 반환

    if user is None:
        # 토큰은 유효하지만 해당 ID의 유저가 DB에 없는 경우 (탈퇴한 회원 등)
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

    return user  # User 모델 객체 반환. 이걸 엔드포인트 함수에서 current_user로 받아 사용


# ── 회원가입 ──────────────────────────────────────────────────────────────────────
@router.post("/register", response_model=UserResponse, status_code=201)
# response_model=UserResponse: 반환값을 UserResponse 스키마로 자동 변환. 비밀번호 같은 필드 자동 제거
# status_code=201: 성공 시 200 대신 201(Created) 반환. 새 리소스 생성 성공을 나타내는 관례
def register(
    body: UserRegister,       # 요청 바디(JSON)를 UserRegister 스키마로 자동 파싱 + 검증
    db: Session = Depends(get_db)  # DB 세션 자동 주입
):
    existing_user = db.query(User).filter(User.email == body.email).first()
    # 이미 같은 이메일로 가입한 유저가 있는지 확인
    # .filter(User.email == body.email): WHERE email = '입력한 이메일' 조건

    if existing_user:
        # 이미 존재하면 400 Bad Request 에러 발생
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")

    new_user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password)
        # 평문 비밀번호를 bcrypt 해시로 변환해서 저장. 절대 body.password 그대로 저장 금지
    )
    # 위 코드는 아직 DB에 저장된 게 아님. 메모리에 User 객체만 만든 상태

    db.add(new_user)      # DB 세션에 새 유저 객체 추가 (아직 INSERT 안 됨)
    db.commit()           # 실제로 DB에 INSERT 쿼리 실행. 이 시점에 저장됨
    db.refresh(new_user)  # DB에서 방금 저장된 데이터를 다시 읽어옴. auto_increment로 채워진 id 등을 반영

    return new_user
    # response_model=UserResponse 덕분에 new_user(User 객체)가 자동으로 UserResponse 형태로 변환되어 반환


# ── 로그인 ────────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
# response_model=TokenResponse: 반환값을 {"access_token": "...", "token_type": "bearer"} 형태로 변환
def login(
    body: UserLogin,            # 요청 바디를 UserLogin 스키마로 파싱 (email, password)
    db: Session = Depends(get_db)  # DB 세션 자동 주입
):
    user = db.query(User).filter(User.email == body.email).first()
    # 입력한 이메일로 DB에서 유저 조회

    if not user:
        # 해당 이메일의 유저가 없으면 401 에러
        # 보안상 "이메일이 없습니다" 대신 "이메일 또는 비밀번호가 틀렸습니다"로 모호하게 표현
        # 어떤 게 틀렸는지 알려주면 해커가 이메일 존재 여부를 알아낼 수 있음
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다")

    if not verify_password(body.password, user.hashed_password):
        # 비밀번호 불일치. 입력한 비밀번호와 DB의 해시값을 비교
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다")

    access_token = create_access_token(data={"sub": str(user.id)})
    # JWT 토큰 생성. payload에 유저 ID를 "sub" 키로 담음
    # str(user.id): id는 int인데 JWT payload는 문자열로 저장하는 관례

    return {"access_token": access_token, "token_type": "bearer"}
    # 프론트는 이 access_token을 localStorage에 저장하고
    # 이후 모든 요청 헤더에 Authorization: Bearer <access_token> 형태로 포함시킴


# ── 내 정보 조회 ──────────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
# response_model=UserResponse: 반환값을 UserResponse(id, email, username)로 변환. 비밀번호 자동 제외
def me(
    current_user: User = Depends(get_current_user)
    # Depends(get_current_user): 위에서 만든 함수를 호출해서 로그인된 유저를 자동으로 가져옴
    # 토큰이 없거나 유효하지 않으면 get_current_user 안에서 401 에러가 먼저 발생함
    # 즉, 이 함수 본문까지 실행됐다면 current_user는 반드시 유효한 User 객체
):
    return current_user  # 그냥 반환하면 response_model이 알아서 UserResponse 형태로 변환


# ── 내 정보 수정 (닉네임 변경) ───────────────────────────────────────────────────
from pydantic import BaseModel

class UserUpdate(BaseModel):
    username: Optional[str] = None
    preferences: Optional[str] = None  # JSON 문자열: {"likes":["음악","산책"],"dislikes":["운동"]}

@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if body.username is not None:
        if len(body.username.strip()) < 1:
            raise HTTPException(status_code=400, detail="닉네임을 입력해주세요")
        current_user.username = body.username.strip()

    if body.preferences is not None:
        current_user.preferences = body.preferences

    db.commit()
    db.refresh(current_user)
    return current_user
