from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session

from ..core.database import get_db

from ..core.security import hash_password, verify_password, create_access_token

from ..models.user import User

from typing import Optional
from ..schemas.user import UserRegister, UserLogin, TokenResponse, UserResponse

from fastapi.security import OAuth2PasswordBearer

from ..core.security import decode_access_token

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:

    user_id = decode_access_token(token)

    if user_id is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 유효하지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(user_id)).first()

    if user is None:

        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

    return user

@router.post("/register", response_model=UserResponse, status_code=201)

def register(
    body: UserRegister,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(User.email == body.email).first()

    if existing_user:

        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")

    new_user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password)

    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.post("/login", response_model=TokenResponse)

def login(
    body: UserLogin,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == body.email).first()

    if not user:

        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다")

    if not verify_password(body.password, user.hashed_password):

        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸습니다")

    access_token = create_access_token(data={"sub": str(user.id)})

    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)

def me(
    current_user: User = Depends(get_current_user)

):
    return current_user

from pydantic import BaseModel

class UserUpdate(BaseModel):
    username: Optional[str] = None
    preferences: Optional[str] = None

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
