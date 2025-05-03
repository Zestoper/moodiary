# ─── 비밀번호 해시 + JWT 토큰 생성/검증 담당 파일 ───────────────────────────────

from datetime import datetime, timedelta  # datetime: 현재 시각, timedelta: "60분 후" 같은 시간 간격 계산에 사용
from typing import Optional               # Optional[str]: str이거나 None일 수 있다는 타입 힌트

from jose import JWTError, jwt           # jose 라이브러리: JWT 토큰을 만들고(jwt.encode) 읽는(jwt.decode) 기능 제공
                                          # JWTError: 토큰이 위조/만료됐을 때 발생하는 에러 클래스

from passlib.context import CryptContext  # passlib 라이브러리: 비밀번호를 안전하게 해시하는 기능 제공

from .config import settings              # .env에서 읽어온 설정값 (SECRET_KEY, ALGORITHM, 만료시간)


# ── 비밀번호 해시 설정 ────────────────────────────────────────────────────────────
# CryptContext: 어떤 해시 알고리즘을 사용할지 설정하는 객체
# schemes=["bcrypt"]: bcrypt 알고리즘 사용. 단방향 해시라서 해시값으로 원본 비밀번호를 역산 불가능
# deprecated="auto": 나중에 더 강력한 알고리즘으로 바꿔도 기존 해시를 자동으로 처리해줌
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── 비밀번호 관련 함수 2개 ────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    # 평문 비밀번호("1234")를 bcrypt 해시값("$2b$12$...")으로 변환
    # DB에는 절대 평문을 저장하지 않고 이 해시값을 저장함
    # 같은 비밀번호라도 실행할 때마다 다른 해시가 나옴 (salt 때문에) → 보안 강화
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # 로그인할 때 사용. 사용자가 입력한 비밀번호와 DB의 해시값을 비교
    # plain_password: 사용자가 입력한 "1234"
    # hashed_password: DB에 저장된 "$2b$12$..."
    # 내부적으로 plain_password를 해시해서 hashed_password와 비교함 → True/False 반환
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT 토큰 관련 함수 2개 ────────────────────────────────────────────────────────
# JWT란? JSON Web Token. 로그인 후 서버가 발급하는 "출입증" 같은 것
# 구조: header.payload.signature (점으로 구분된 3부분)
# header: 알고리즘 정보, payload: 담긴 데이터(유저ID 등), signature: 위조 방지 서명

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    # data: 토큰 안에 담을 정보. 보통 {"sub": "유저ID"} 형태로 넘겨줌
    # sub는 JWT 표준 필드명. "subject(주체)"의 약자로 이 토큰이 누구것인지 나타냄

    to_encode = data.copy()  # 원본 data를 건드리지 않기 위해 복사본을 만들어서 수정함

    if expires_delta:
        # expires_delta가 주어지면 현재 시각 + 해당 시간만큼을 만료 시각으로 설정
        expire = datetime.utcnow() + expires_delta
    else:
        # expires_delta가 없으면 설정 파일의 기본값(60분)을 사용
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    # "exp"는 JWT 표준 필드. 만료 시각을 담음. jwt.decode할 때 자동으로 만료 여부를 체크함

    encoded_jwt = jwt.encode(
        to_encode,          # 토큰에 담을 데이터 (payload)
        settings.SECRET_KEY, # 서명에 사용할 비밀키. 이 키로 서명해야만 유효한 토큰 생성 가능
        algorithm=settings.ALGORITHM  # 서명 알고리즘. HS256 사용
    )
    # jwt.encode 결과: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...." 형태의 문자열

    return encoded_jwt  # 이 토큰을 로그인 응답으로 프론트에 전달함


def decode_access_token(token: str) -> Optional[str]:
    # 프론트가 보낸 토큰을 해석해서 유저 ID를 꺼내는 함수
    # 토큰이 위조됐거나 만료됐으면 None을 반환해서 인증 실패 처리
    try:
        payload = jwt.decode(
            token,               # 프론트에서 받은 토큰 문자열
            settings.SECRET_KEY,  # 서명 검증에 사용할 비밀키. 인코딩할 때 쓴 키와 같아야 함
            algorithms=[settings.ALGORITHM]  # 허용할 알고리즘 목록
        )
        # jwt.decode 성공 시: payload = {"sub": "유저ID", "exp": 만료시각} 형태의 dict
        # "exp" 만료 체크는 jwt.decode가 자동으로 해줌. 만료됐으면 JWTError 발생

        user_id: str = payload.get("sub")
        # payload에서 "sub" 필드(유저 ID)를 꺼냄
        # .get()을 쓰는 이유: "sub"가 없으면 KeyError 대신 None을 반환하게 하기 위해

        return user_id  # 유저 ID 문자열 반환. 이걸로 DB에서 유저 조회

    except JWTError:
        # 토큰이 위조됐거나, 만료됐거나, 형식이 잘못됐을 때 발생
        return None  # None을 반환하면 호출한 쪽에서 401 Unauthorized 처리
