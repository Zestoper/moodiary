import requests
from fastapi import APIRouter, Depends
from typing import Optional

from ..core.config import settings
from ..routers.auth import get_current_user
from ..models.user import User

router = APIRouter()

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
    genres: Optional[str] = None,
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
                "type": "playlist",
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

                "image": item["snippet"]["thumbnails"].get("medium", {}).get("url")
                         or item["snippet"]["thumbnails"].get("default", {}).get("url"),

                "url": f"https://music.youtube.com/playlist?list={item['id']['playlistId']}",
            }
            for item in items
            if item.get("id", {}).get("playlistId")
        ]
        return {"playlists": playlists, "configured": True}

    except Exception:
        return {"playlists": [], "configured": True}
