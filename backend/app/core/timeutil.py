"""시간대 도우미.

DB(Supabase PostgreSQL · 서버 시간대 UTC)는 created_at을 'UTC 시각을 시간대 표시 없이(naive)' 저장한다.
그대로 내보내면 브라우저가 한국 시각으로 착각해 새벽 0~9시에 쓴 일기가 전날로 보이고,
서버(Render · UTC)에서 .date()나 date.today()를 쓰면 한국 날짜와 하루 어긋난다.
→ 내보낼 때는 UTC 표시(+00:00)를 붙이고, 날짜 계산은 한국 시간 기준으로 한다.
"""
from datetime import date, datetime, timezone
from typing import Annotated, Optional
from zoneinfo import ZoneInfo

from pydantic import PlainSerializer

KST = ZoneInfo("Asia/Seoul")


def as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def to_kst(dt: datetime) -> datetime:
    return as_utc(dt).astimezone(KST)


def kst_date(dt: Optional[datetime]) -> Optional[date]:
    return to_kst(dt).date() if dt else None


def kst_today() -> date:
    return datetime.now(KST).date()


def kst_to_utc_naive(dt: datetime) -> datetime:
    """한국 시각(naive)을 DB 비교용 UTC naive로."""
    return dt.replace(tzinfo=KST).astimezone(timezone.utc).replace(tzinfo=None)


def iso_utc(dt: Optional[datetime]) -> Optional[str]:
    return as_utc(dt).isoformat() if dt else None


# 응답 스키마용: naive UTC를 '...+00:00'으로 내보내 브라우저가 한국 시각으로 바르게 바꾸게 한다
UTCDateTime = Annotated[datetime, PlainSerializer(lambda v: as_utc(v).isoformat(), return_type=str)]
