"""
AI 친구의 '기억' — 예전 일기에서 지금 대화와 관련된 것을 찾아 대화에 넣는다 (검색 증강 생성 · RAG).

왜 필요한가
- 채팅방은 일기마다 나뉘어 있다. 감정이 다른 일기의 대화가 섞이면 엉뚱한 위로를 하기 때문.
- 그런데 그 때문에 AI가 지난 일들을 전혀 몰랐다 ("시험 어떻게 됐어?"를 물어볼 수 없음).
- 대화방은 계속 나누고, 지금 대화와 '관련 있는 기억만' 골라서 가져온다.

어떻게 저장하나 (일기를 쓰거나 고칠 때 백그라운드에서 한 번)
- memory          : 나중에 떠올릴 1~2문장 요약 ("동생과 다퉈서 속상했다")
- memory_keywords : 검색용 핵심어 ("동생,다툼,사과")
- follow_up       : 나중에 먼저 물어볼 질문 ("면접은 잘 봤어?") + follow_up_date (그 일이 있는 날)

어떻게 찾나 — 벡터 검색 대신 키워드 점수
- 사용자 한 명의 일기는 많아야 수백 개라 키워드 겹침 + 최근성 + 감정 유사도로 충분히 고를 수 있다
- 임베딩 API · 벡터 DB 없이 무료 서버(512MB)에서 바로 동작한다. 일기가 많아지면 pgvector로 바꿀 수 있게 점수 계산을 이 파일에 모았다
"""
import json
import math
import re
import threading
from ..core.timeutil import kst_date, kst_today
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from ..core.database import SessionLocal
from ..models.diary import Diary

MAX_MEMORIES = 4          # 대화에 넣을 관련 기억 수
CANDIDATES = 300          # 점수를 매길 최근 일기 수
FOLLOW_UP_WINDOW = 7      # 그 일이 있던 날부터 며칠 안에 물어볼지

# 한국어 조사·어미를 대충 떼어 낸다 ("시험을" → "시험", "면접이었는데" → "면접")
_SUFFIX_RE = re.compile(
    r"(으로부터|에게서|이었는데|였는데|이었다|였다|에서는|에게는|으로는|이라서|라서|이랑|에서|에게|으로|부터|까지|처럼|보다|하고|이나|이랑|"
    r"은|는|이|가|을|를|에|의|도|만|과|와|로|랑|야|아|요|다)$"
)
_STOPWORDS = {"오늘", "그냥", "진짜", "너무", "정말", "그리고", "그래서", "하지만", "근데", "나는", "내가", "우리", "있었다", "했다", "같다", "생각"}


def tokens(text: str) -> set[str]:
    out = set()
    for w in re.findall(r"[가-힣A-Za-z0-9]{2,}", text or ""):
        w = _SUFFIX_RE.sub("", w.lower())
        if len(w) >= 2 and w not in _STOPWORDS:
            out.add(w)
    return out


def _diary_terms(d: Diary) -> set[str]:
    kw = {k.strip().lower() for k in (d.memory_keywords or "").split(",") if k.strip()}
    terms = kw | tokens(d.memory or "") | tokens(d.title or "")
    if not d.memory:   # 기억이 아직 안 만들어진 예전 일기는 본문 앞부분으로 대신 찾는다
        terms |= tokens((d.content or "")[:500])
    return terms


def _days_ago(d: Diary, today: date) -> int:
    created = kst_date(d.created_at) or today
    return max((today - created).days, 0)


def _when(days: int) -> str:
    if days == 0:
        return "오늘"
    if days == 1:
        return "어제"
    if days < 7:
        return f"{days}일 전"
    if days < 35:
        return f"{days // 7}주 전"
    return f"{days // 30}달 전"


def recall(db: Session, user_id: int, query_text: str, current_diary_id: int | None = None) -> dict:
    """지금 대화와 관련된 예전 일기 기억 + 지금 물어볼 만한 후속 질문을 고른다."""
    today = kst_today()
    q_terms = tokens(query_text)
    current = None
    if current_diary_id:
        current = db.query(Diary).filter(Diary.id == current_diary_id, Diary.user_id == user_id).first()
    current_tags = set((current.emotion_tags or "").split(",")) - {""} if current else set()

    candidates = (
        db.query(Diary)
        .filter(Diary.user_id == user_id, Diary.id != (current_diary_id or -1))
        .order_by(Diary.created_at.desc())
        .limit(CANDIDATES)
        .all()
    )

    scored = []
    for d in candidates:
        days = _days_ago(d, today)
        overlap = len(q_terms & _diary_terms(d))
        if overlap == 0:
            continue
        tags = set((d.emotion_tags or "").split(",")) - {""}
        score = overlap * 2.0 + 1.5 * math.exp(-days / 30) + 0.5 * len(current_tags & tags)
        scored.append((score, days, d))
    scored.sort(key=lambda x: -x[0])

    memories = [
        {"diary_id": d.id, "title": d.title, "when": _when(days),
         "date": kst_date(d.created_at).isoformat() if d.created_at else None,
         "text": d.memory or (d.content or "")[:120]}
        for _, days, d in scored[:MAX_MEMORIES]
    ]

    # 후속 질문: 그 일이 있는 날이 지났고(최근 7일 안) 아직 안 물어본 것
    follow_ups = [
        {"diary_id": d.id, "title": d.title, "question": d.follow_up,
         "date": d.follow_up_date.isoformat() if d.follow_up_date else None}
        for d in candidates
        if d.follow_up and d.follow_up_date and not d.follow_up_asked
        and today - timedelta(days=FOLLOW_UP_WINDOW) <= d.follow_up_date <= today
    ][:2]

    return {"memories": memories, "follow_ups": follow_ups}


def memory_prompt(recalled: dict) -> str:
    """시스템 프롬프트에 붙일 기억 블록. 없으면 빈 문자열."""
    lines = []
    if recalled["memories"]:
        lines.append("[사용자에 대해 기억하는 것 — 예전 일기에서 찾은 관련 내용]")
        for m in recalled["memories"]:
            lines.append(f"- {m['when']} '{m['title']}': {m['text']}")
        lines.append("관련 있을 때만 자연스럽게 떠올리듯 언급하세요 (예: '저번에 ~했다고 했잖아'). 기억을 나열하거나 일기를 봤다고 말하지 마세요.")
    if recalled["follow_ups"]:
        lines.append("[이번 대화에서 먼저 안부를 물어볼 것 — 예전에 예정돼 있던 일]")
        for f in recalled["follow_ups"]:
            lines.append(f"- {f['question']} (원래 일기: '{f['title']}')")
        lines.append("대화 흐름을 해치지 않게 한 번만 가볍게 물어보세요.")
    return "\n".join(lines)


def mark_follow_ups_asked(db: Session, recalled: dict) -> None:
    ids = [f["diary_id"] for f in recalled.get("follow_ups", [])]
    if ids:
        db.query(Diary).filter(Diary.id.in_(ids)).update({Diary.follow_up_asked: True}, synchronize_session=False)
        db.commit()


# ── 기억 만들기 (일기 저장 직후 백그라운드) ──────────────────────────────────────────

def _build(diary_id: int) -> None:
    from .groq import extract_memory
    db = SessionLocal()
    try:
        d = db.query(Diary).filter(Diary.id == diary_id).first()
        if not d:
            return
        written = kst_date(d.created_at) or kst_today()
        data = extract_memory(d.title, d.content, written)
        d.memory = (data.get("memory") or "").strip()[:300] or None
        kws = data.get("keywords") or []
        d.memory_keywords = ",".join(str(k).strip() for k in kws if str(k).strip())[:255] or None
        fu = data.get("follow_up") or {}
        question = (fu.get("question") or "").strip() if isinstance(fu, dict) else ""
        fu_date = None
        if question and isinstance(fu, dict) and fu.get("date"):
            try:
                fu_date = datetime.strptime(fu["date"], "%Y-%m-%d").date()
            except ValueError:
                fu_date = None
        d.follow_up = question[:255] or None
        d.follow_up_date = fu_date if question else None
        d.follow_up_asked = False
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[기억] 만들기 실패 diary={diary_id} {type(e).__name__}: {str(e)[:160]}")
    finally:
        db.close()


def build_memory_in_background(diary_id: int) -> None:
    threading.Thread(target=_build, args=(diary_id,), daemon=True).start()


def backfill_memories(db: Session, user_id: int, limit: int = 3) -> None:
    """기능 도입 전에 쓴 일기들의 기억을 조금씩 채운다 (채팅할 때마다 최근 것부터 몇 개씩 — AI 한도 보호)."""
    ids = [r.id for r in db.query(Diary.id).filter(Diary.user_id == user_id, Diary.memory == None)  # noqa: E711
           .order_by(Diary.created_at.desc()).limit(limit)]
    if ids:
        def _run():
            for i in ids:
                _build(i)
        threading.Thread(target=_run, daemon=True).start()


def memory_refs_json(recalled: dict) -> str | None:
    """AI 답장에 함께 저장할 '이 답장이 떠올린 기억' 목록 (화면에 칩으로 보여줌)."""
    refs = [{"diary_id": m["diary_id"], "title": m["title"], "when": m["when"]} for m in recalled.get("memories", [])]
    return json.dumps(refs, ensure_ascii=False) if refs else None
