# ─── 일기 관련 요청/응답 데이터 형태(스키마)를 정의하는 파일 ──────────────────────
# 요청 스키마: 프론트가 서버에 보내는 데이터 형태
# 응답 스키마: 서버가 프론트에 돌려주는 데이터 형태

from pydantic import BaseModel  # 스키마의 부모 클래스. 이걸 상속받아야 FastAPI가 자동 검증해줌
from typing import Optional      # Optional[str]: str이거나 None이어도 됨. 선택 입력 필드에 사용
from datetime import datetime    # 작성 시각 등 날짜/시간 타입에 사용


# ── 일기 작성 요청 스키마 ─────────────────────────────────────────────────────────
class DiaryCreate(BaseModel):
    title: str
    content: str
    weather_code: Optional[int] = None   # WMO 기상 코드 (0=맑음, 61=비, 71=눈 등)
    temperature: Optional[float] = None  # 섭씨 기온


# ── 일기 수정 요청 스키마 ─────────────────────────────────────────────────────────
class DiaryUpdate(BaseModel):
    # 프론트에서 일기 수정 시 보내는 데이터
    # Optional: 제목만 바꾸거나 본문만 바꿀 수 있게 둘 다 선택 입력으로 설정
    # 예: {"title": "수정된 제목"} → content는 안 보내도 됨
    title: Optional[str] = None    # 수정할 제목. 안 보내면 None → 기존 값 유지
    content: Optional[str] = None  # 수정할 본문. 안 보내면 None → 기존 값 유지


# ── 일기 응답 스키마 ──────────────────────────────────────────────────────────────
class DiaryResponse(BaseModel):
    # 서버가 프론트에 일기 데이터를 돌려줄 때 사용하는 형태
    # DB의 Diary 모델에서 프론트에 보내도 되는 필드만 골라 담음
    id: int                           # 일기 고유 ID
    user_id: int                      # 작성자 유저 ID
    title: str                        # 일기 제목
    content: str                      # 일기 본문
    emotion_tags: Optional[str]
    emotion_score: Optional[int]
    weather_code: Optional[int]
    temperature: Optional[float]
    solution: Optional[str] = None    # AI 생성 맞춤 솔루션
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        # SQLAlchemy의 Diary 모델 객체를 이 스키마로 바로 변환 가능하게 해주는 설정
        # 없으면 "Diary 객체를 DiaryResponse로 변환 불가" 에러 발생
