# ─── 음악 추천 API (YouTube Data API v3) ─────────────────────────────────────────
# 감정 점수/태그를 받아서 YouTube Music 플레이리스트를 검색해 반환
# API 키 발급: console.cloud.google.com → YouTube Data API v3 활성화 → 사용자 인증 정보 → API 키

import requests
from fastapi import APIRouter, Depends
from typing import Optional

from ..core.config import settings
from ..routers.auth import get_current_user
from ..models.user import User

router = APIRouter()

# 감정 태그 → 무드 키워드
EMOTION_MOOD = {
    "기쁨":  "happy upbeat",
    "설렘":  "exciting upbeat",
    "감사":  "feel good",
    "평온":  "peaceful calm",
    "희망":  "uplifting hopeful",
    "슬픔":  "sad healing",
    "우울":  "melancholy healing",
    "외로움": "lonely healing lofi",
    "불안":  "calming relaxing",
    "분노":  "intense focus",
}

# 장르 → 검색 키워드
GENRE_QUERY = {
    "팝":    "pop",
    "K-POP": "kpop",
    "발라드": "ballad",
    "힙합":  "hip hop",
    "R&B":   "rnb soul",
    "인디":  "indie acoustic",
    "재즈":  "jazz",
    "클래식": "classical",
    "록":    "rock",
    "EDM":   "edm electronic",
    "트로트": "trot",
    "OST":   "ost soundtrack",
}


def _build_query(score: Optional[int], tags: Optional[str], genres: Optional[str] = None) -> str:
    # 무드 결정: 감정 태그 우선, 없으면 점수 기반
    mood = None
    if tags:
        for ko, m in EMOTION_MOOD.items():
            if ko in tags:
                mood = m
                break
    if not mood:
        if score and score >= 4: mood = "happy upbeat"
        elif score and score <= 2: mood = "healing calm"
        else: mood = "chill relaxing"

    # 장르 결정: 첫 번째 선택 장르 사용
    genre = ""
    if genres:
        for g in genres.split(","):
            g = g.strip()
            if g in GENRE_QUERY:
                genre = GENRE_QUERY[g]
                break

    if genre:
        return f"{mood} {genre} playlist"
    return f"{mood} music playlist"


@router.get("/recommend")
def recommend_music(
    score: Optional[int] = None,
    tags: Optional[str] = None,
    genres: Optional[str] = None,  # 쉼표 구분 장르 문자열. 예: "재즈,발라드"
    current_user: User = Depends(get_current_user),
):
    if not settings.YOUTUBE_API_KEY or settings.YOUTUBE_API_KEY == "your_youtube_api_key_here":
        return {"playlists": [], "configured": False}

    try:
        query = _build_query(score, tags, genres)
        resp = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": query,
                "type": "playlist",   # 개별 영상 아닌 플레이리스트 검색
                "maxResults": 3,
                "key": settings.YOUTUBE_API_KEY,
            },
            timeout=5,
        )
        items = resp.json().get("items", [])
        playlists = [
            {
                "id": item["id"]["playlistId"],
                "name": item["snippet"]["title"],
                # medium 썸네일(320x180) 사용. 없으면 default 썸네일로 폴백
                "image": item["snippet"]["thumbnails"].get("medium", {}).get("url")
                         or item["snippet"]["thumbnails"].get("default", {}).get("url"),
                # YouTube Music으로 직접 연결
                "url": f"https://music.youtube.com/playlist?list={item['id']['playlistId']}",
            }
            for item in items
            if item.get("id", {}).get("playlistId")  # playlistId 없는 항목 제외
        ]
        return {"playlists": playlists, "configured": True}

    except Exception:
        return {"playlists": [], "configured": True}
