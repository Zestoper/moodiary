# ─── 유저 관련 요청/응답 데이터 형태(스키마)를 정의하는 파일 ──────────────────────
# 스키마(Schema)란? API가 받거나 보내는 데이터의 "틀". 어떤 필드가 필요한지 정의함
# FastAPI가 이 틀을 보고 자동으로 유효성 검사를 해줌. 틀이 안 맞으면 422 에러 자동 반환

from pydantic import BaseModel, EmailStr, Field
from typing import Optional


# ── 회원가입 요청 스키마 ───────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    # 프론트에서 회원가입 시 이 3가지를 JSON으로 보내야 함
    # 예: {"email": "test@gmail.com", "username": "홍길동", "password": "1234"}
    email: EmailStr
    username: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=6)


# ── 로그인 요청 스키마 ────────────────────────────────────────────────────────────
class UserLogin(BaseModel):
    # 프론트에서 로그인 시 이 2가지를 JSON으로 보내야 함
    # 예: {"email": "test@gmail.com", "password": "1234"}
    email: EmailStr   # 이메일
    password: str     # 비밀번호


# ── 로그인 응답 스키마 ────────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    # 로그인 성공 시 서버가 프론트에 보내는 응답
    # 예: {"access_token": "eyJhbG...", "token_type": "bearer"}
    access_token: str   # 발급된 JWT 토큰 문자열. 프론트는 이걸 localStorage에 저장해서 이후 요청마다 헤더에 포함
    token_type: str     # 토큰 종류. JWT는 관례적으로 "bearer"를 씀
                        # 프론트에서 요청 시: Authorization: Bearer eyJhbG... 형태로 헤더에 넣음


# ── 유저 정보 응답 스키마 ─────────────────────────────────────────────────────────
class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    preferences: Optional[str] = None  # JSON 문자열로 저장된 선호도
    is_admin: bool = False              # 관리자 여부. 프론트에서 관리자 메뉴 노출 여부 판단에 사용
    credits: int = 0                   # 보유 크레딧 수. 프론트 네비게이션에 잔액 표시용

    class Config:
        from_attributes = True
        # SQLAlchemy 모델 객체(User)를 이 스키마로 바로 변환 가능하게 해주는 설정
        # 없으면 "User 객체를 UserResponse로 변환할 수 없다"는 에러 발생
        # 예: UserResponse.model_validate(db_user) → User 모델 객체를 자동으로 dict처럼 읽어서 변환
