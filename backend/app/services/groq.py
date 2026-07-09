# ─── Groq AI 호출 함수 모음 ───────────────────────────────────────────────────────
# Groq: LLaMA 같은 오픈소스 모델을 무료로 빠르게 쓸 수 있는 AI 서비스

import json                          # AI 응답(문자열)을 dict로 파싱할 때 사용
import re                            # 한자/일본어 필터링용 정규식
from groq import Groq                # Groq 클라이언트 클래스. API 호출의 시작점
from ..core.config import settings   # .env의 GROQ_API_KEY를 가져옴

# Groq 클라이언트 인스턴스 생성. 앱 전체에서 이 하나를 공유함
# api_key: Groq 서버에 "나 인증된 사용자야" 라고 알려주는 키
client = Groq(api_key=settings.GROQ_API_KEY)

# 모델명 상수. 변경 시 이 두 줄만 수정하면 됨
MODEL_GENERAL = "llama-3.3-70b-versatile"  # 감정 분석, 솔루션, 리포트, 연애 상담에 사용
MODEL_CHAT    = "qwen/qwen3-32b"           # 실시간 채팅 스트리밍에 사용 (한국어 맞춤법 우수)

def _filter_cjk(text: str) -> str:
    # 한자/일본어/키릴 문자(러시아어 등)를 공백으로 대체. "그期間에" → "그 에"
    # \u0400-\u04FF: 키릴 문자 범위 (러시아어, 우크라이나어 등 슬라브 언어)
    cleaned = re.sub(r'[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3041-\u30FF\u31F0-\u31FF\u0400-\u04FF]', ' ', text)
    return re.sub(r' {2,}', ' ', cleaned)  # .strip() 없음: 스트리밍 청크의 단어 경계 공백(' 힘' 등) 유지

def _filter_think_tags(text: str) -> str:
    # Qwen3 thinking 모드의 <think>...</think> 블록 제거
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()

# ── 감정 분석 함수 ────────────────────────────────────────────────────────────────
def analyze_emotion(content: str) -> dict:
    # 일기 본문을 받아서 감정 태그와 감정 점수를 반환하는 함수
    # content: 일기 본문 텍스트. 예: "오늘 친구랑 밥을 먹었는데 너무 즐거웠다"
    # 반환값 예: {"emotion_tags": "기쁨,설렘", "emotion_score": 4}

    response = client.chat.completions.create(
        model=MODEL_GENERAL,
        # Groq에서 제공하는 무료 모델
        # llama-3.3-70b-versatile: 700억 파라미터. 정확도 높고 무료

        messages=[
            {
                "role": "system",
                # system: AI에게 역할과 행동 방식을 지시하는 메시지
                # 여기서 정한 규칙을 AI가 대화 내내 따름
                "content": """당신은 감정 분석 전문가입니다.
일기 내용을 읽고 반드시 아래 JSON 형식으로만 응답하세요. 다른 말은 절대 하지 마세요.

{"emotion_tags": "감정1,감정2", "emotion_score": 숫자}

감정 태그 규칙:
- 아래 목록에서만 선택: 기쁨, 슬픔, 분노, 불안, 설렘, 감사, 외로움, 평온, 우울, 희망
- 최대 3개까지, 쉼표로 구분

감정 점수 규칙:
- 1점: 매우 부정적
- 2점: 부정적
- 3점: 중립
- 4점: 긍정적
- 5점: 매우 긍정적"""
            },
            {
                "role": "user",
                # user: 실제 분석할 일기 내용을 AI에게 전달
                "content": content  # 일기 본문이 여기 들어감
            }
        ],
        temperature=0.3,
        # temperature: AI 응답의 창의성/일관성 조절. 0~1 사이 값
        # 0에 가까울수록 일관된 답변. 감정 분석은 일관성이 중요하므로 낮게 설정

        max_tokens=100,
        # 응답 최대 길이. JSON 응답만 받으면 되므로 100으로 충분
    )

    raw = response.choices[0].message.content.strip()
    # response.choices[0]: AI 응답 목록의 첫 번째 (보통 하나만 옴)
    # .message.content: 실제 텍스트 응답. 예: '{"emotion_tags": "기쁨,설렘", "emotion_score": 4}'
    # .strip(): 앞뒤 공백/줄바꿈 제거

    result = json.loads(raw)
    # JSON 문자열 → 파이썬 dict로 변환
    # '{"emotion_tags": "기쁨"}' → {"emotion_tags": "기쁨"}

    return result
    # 반환값 예: {"emotion_tags": "기쁨,설렘", "emotion_score": 4}

# ── 페르소나별 시스템 프롬프트 ────────────────────────────────────────────────────
PERSONA_PROMPTS = {
    "friend": """반말로 친근하게 대화해. 상황 파악 → 감정 공감 → 필요하면 질문 하나. 2~3문장.""",
    "mentor": """인생 경험이 풍부한 따뜻한 선배야. 다정한 반말로 경험에서 우러난 조언을 해줘.
섣불리 답 주기보다 함께 생각해보는 스타일, 격려 잊지 마. 2~3문장.""",
    "counselor": """전문 심리 상담사야. 존댓말 사용, 차분하고 객관적으로 대화해.
감정을 판단하지 말고 수용하며, 내담자가 스스로 답 찾도록 돕는 질문을 해. 2~3문장.""",
    "cheerleader": """무조건 긍정하고 응원하는 하이텐션 응원단이야! 반말, 느낌표 많이 써!
어떤 상황도 긍정적으로 해석하고 '할 수 있어!', '최고야!' 같은 응원 아끼지 마! 2~3문장!""",
    "simsimi": """넌 심심이야. 예상치 못한 엉뚱하고 위트 있는 답변을 해. 반말 사용.
진지한 척하다가 뜬금없이 웃긴 말로 끝내거나, 짧고 핵심 찌르는 답변을 해.
공감은 하되 너무 진지하지 않게. 1~2문장으로 짧게.""",
    "realist": """넌 채찍질하는 현실 조언자야. 반말.
수면이나 건강에 대한 의학적 주장은 절대 하지 마. "자면 피곤해진다", "자면 안 된다" 같은 말 금지.
대신 해야 할 일을 안 했을 때의 현실적인 결과(시험, 마감, 뒤처짐 등)를 짚고, 지금 당장 할 행동을 말해.
사용자가 말하지 않은 것(게임 등)은 언급하지 마.
응답 예시: "지금 공부 안 하면 그 분량 내일로 넘어가. 책 펴.", "피곤한 건 알겠는데, 지금 안 하면 나중에 더 힘들어져. 일단 시작해."
2문장으로 끝내.""",
}

LANGUAGE_RULE = """[언어 규칙]
자연스러운 한국어로 답변하세요. 올바른 맞춤법과 띄어쓰기를 지켜주세요.
한자(漢字), 중국어, 일본어는 사용하지 마세요. 한자 대신 한글로: 기간, 피로, 감사, 감정, 경험.
당신은 사용자의 감정을 이해하고 공감해주는 AI입니다.

[맞춤법 규칙 - 반드시 지키세요]
동사 활용 시 어간을 변형하지 마세요.
올바른 예: 자다→자면 O (잘면 X), 가다→가면 O (갈면 X), 오다→오면 O (올면 X), 자다→자야 O (잘야 X).
이러한 형태는 절대 쓰지 마세요: 잘면, 갈면, 올면, 잘야."""

# ── AI 친구 채팅 함수 ─────────────────────────────────────────────────────────────
def chat_with_ai(messages: list, diary_context: str = "") -> str:
    # 사용자와 AI의 대화 내역을 받아서 AI 응답을 반환하는 함수
    # messages: 지금까지의 대화 목록. [{"role": "user", "content": "..."}, ...]
    # diary_context: 일기 내용. AI가 맥락을 이해하고 공감하는 데 사용. 없어도 됨
    # 반환값: AI의 응답 텍스트

    system_prompt = """[언어 규칙 - 절대 준수]
오직 한국어(한글)로만 답변하세요.
한자, 중국어 간체/번체, 일본어, 영어 알파벳을 단 한 글자도 사용하지 마세요.
사용 가능한 문자: 한글, 숫자(0-9), 한국어 문장부호(. , ! ? ...)만 허용됩니다.
위반 시 응답 전체를 다시 작성하세요.

당신은 사용자의 감정을 이해하고 공감해주는 AI 친구입니다.
반말로 친근하게 대화하세요.

답변 방식:
1. 사용자가 말한 상황을 먼저 정확하게 파악하고 요약해줘
2. 그 상황에 맞는 감정을 공감해줘
3. 필요하면 상황을 더 알고 싶을 때 질문 한 가지만 해줘
2~3문장으로 짧게 답변하세요."""
    # system_prompt: AI의 성격과 말투를 정의하는 지시문

    if diary_context:
        system_prompt += f"\n\n사용자의 최근 일기 내용: {diary_context}"
        # 일기 내용이 있으면 AI가 맥락을 알고 더 공감적인 답변을 할 수 있음

    response = client.chat.completions.create(
        model=MODEL_GENERAL,
        messages=[
            {"role": "system", "content": system_prompt},
            *messages
            # *messages: messages 리스트를 풀어서 넣음
            # [{"role":"user","content":"안녕"}, ...] 형태로 펼쳐짐
        ],
        temperature=0.7,
        # 채팅은 감정 분석보다 창의적인 답변이 필요하므로 0.7로 높게 설정
        max_tokens=300,
    )

    return _filter_cjk(response.choices[0].message.content.strip())
    # AI의 텍스트 응답만 꺼내서 반환. 한자/일본어가 섞여 있으면 제거

# ── AI 친구 채팅 스트리밍 함수 ────────────────────────────────────────────────────
def chat_with_ai_stream(messages: list, diary_context: str = "", persona: str = "friend"):
    # persona: 선택된 AI 말투 스타일. PERSONA_PROMPTS 딕셔너리에서 해당 프롬프트를 가져옴
    persona_text = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["friend"])
    system_prompt = f"{LANGUAGE_RULE}\n\n[역할 - 절대 유지]\n이전 대화 스타일과 관계없이 아래 역할만 따르세요.\n{persona_text}"

    if diary_context:
        system_prompt += f"\n\n사용자의 최근 일기 내용: {diary_context}"

    stream = client.chat.completions.create(
        model=MODEL_CHAT,
        # qwen3-32b: 한국어 맞춤법·띄어쓰기가 llama보다 훨씬 정확함
        messages=[
            {"role": "system", "content": "/no_think\n" + system_prompt},
            # /no_think: Qwen3의 thinking 모드(내부 추론) 비활성화. 빠른 응답을 위해
            *messages
        ],
        temperature=0.7,
        max_tokens=300,
        stream=True,
    )

    # <think>...</think> 블록은 응답 앞부분에 나옴. 버퍼에 모아서 통과시킨 뒤 yield
    think_buf = ''
    think_done = False
    started = False  # think 블록 이후 첫 실제 텍스트가 나왔는지 여부

    for chunk in stream:
        content = chunk.choices[0].delta.content
        if not content:
            continue

        if think_done:
            filtered = _filter_cjk(content).replace('\n', ' ')
            # 응답 내 줄바꿈을 공백으로 변환 (말풍선 안에서 문장 사이 빈 줄 방지)
            if not started:
                filtered = filtered.lstrip()
            if filtered:
                started = True
                yield filtered
        else:
            think_buf += content
            if '</think>' in think_buf:
                after = think_buf[think_buf.find('</think>') + len('</think>'):].lstrip()
                think_done = True
                if after:
                    started = True
                    yield _filter_cjk(after)
            elif len(think_buf) > 300 and '<think>' not in think_buf:
                think_done = True
                started = True
                yield _filter_cjk(think_buf)

# ── 월간 감정 리포트 함수 ─────────────────────────────────────────────────────────
def generate_monthly_report(diaries: list, year: int, month: int) -> str:
    # 한 달 치 일기를 받아서 서술형 감정 리포트 생성
    diary_text = "\n\n".join([
        f"[{d['date']}] {d['title']}\n감정: {d.get('emotion_tags') or '없음'} ({d.get('emotion_score') or '?'}점)\n{d['content'][:150]}"
        for d in diaries
    ])
    response = client.chat.completions.create(
        model=MODEL_GENERAL,
        messages=[
            {
                "role": "system",
                "content": """[언어 규칙 - 절대 준수]
오직 한국어(한글)로만 답변하세요.
한자, 중국어, 일본어, 영어를 단 한 글자도 사용하지 마세요.
사용 가능한 문자: 한글, 숫자(0-9), 한국어 문장부호만 허용됩니다.

당신은 따뜻한 감정 분석 전문가입니다. 한 달 치 일기를 읽고 월간 감정 리포트를 작성하세요.
이번 달 전체 감정 흐름을 2~3문장으로 요약하고, 가장 자주 느낀 감정과 원인을 짚어주세요.
특히 힘들었거나 좋았던 순간을 언급하고, 다음 달을 위한 따뜻한 한마디로 마무리하세요.
전체 250자 이내, 헤더 없이 자연스러운 문단으로 작성하세요."""
            },
            {
                "role": "user",
                "content": f"{year}년 {month}월 일기 {len(diaries)}편:\n\n{diary_text}"
            }
        ],
        temperature=0.7,
        max_tokens=400,
    )
    return response.choices[0].message.content.strip()

# ── 맞춤 솔루션 생성 함수 ─────────────────────────────────────────────────────────
def generate_solution(diary_content: str, emotion_score: int, emotion_tags: str, preferences: dict) -> str:
    # diary_content: 일기 본문, emotion_score: 감정 점수(1~2), emotion_tags: 감정 태그
    # preferences: {"likes": ["음악", "산책"], "dislikes": ["운동"]}
    likes = ', '.join(preferences.get('likes', [])) or '없음'
    dislikes = ', '.join(preferences.get('dislikes', [])) or '없음'

    response = client.chat.completions.create(
        model=MODEL_GENERAL,
        messages=[
            {
                "role": "system",
                "content": """[언어 규칙] 오직 한국어로만 답변하세요. 한자, 일본어, 중국어 사용 금지.

당신은 따뜻한 심리 웰니스 코치입니다.
감정이 안 좋은 사람에게 지금 당장 할 수 있는 맞춤 활동 3가지를 추천하세요.

규칙:
- 사용자가 좋아하는 것을 우선 반영하세요.
- 싫어하는 것은 절대 추천하지 마세요.
- 각 활동은 오늘 바로 실천 가능한 것으로.
- 설교하거나 교훈 주지 말고, 따뜻하게 제안하는 말투로.
- 형식: 활동 이름 한 줄 + 구체적 방법 한 줄. 총 3개."""
            },
            {
                "role": "user",
                "content": f"일기 내용: {diary_content[:300]}\n감정: {emotion_tags} ({emotion_score}점)\n좋아하는 것: {likes}\n싫어하는 것: {dislikes}"
            }
        ],
        temperature=0.7,
        max_tokens=400,
    )
    return response.choices[0].message.content.strip()

# ── 연애 상담 함수 ────────────────────────────────────────────────────────────────
def analyze_relationship(situation: str, my_action: str, partner_action: str) -> dict:
    # 연애 상황을 받아서 잘잘못 판정 + 화해 문자 스크립트를 반환하는 함수
    # situation: 전체 상황 설명
    # my_action: 내가 한 행동
    # partner_action: 상대방이 한 행동
    # 반환값 예: {"verdict": "상대방 잘못", "message_script": "자기야, 나 좀 서운했어..."}

    response = client.chat.completions.create(
        model=MODEL_GENERAL,
        messages=[
            {
                "role": "system",
                "content": """당신은 연애 상담 전문가입니다.
상황을 듣고 반드시 아래 JSON 형식으로만 응답하세요.

{"verdict": "판정결과", "message_script": "화해문자내용"}

판정결과는 반드시 이 중 하나: "내 잘못", "상대방 잘못", "둘 다 잘못", "오해"
화해문자는 진심이 담긴 2~3문장으로 작성하세요."""
            },
            {
                "role": "user",
                "content": f"상황: {situation}\n내가 한 행동: {my_action}\n상대방이 한 행동: {partner_action}"
                # f-string: 변수를 문자열 안에 넣는 방법. {변수명} 형태로 삽입
            }
        ],
        temperature=0.5,  # 판정은 일관성, 화해 문자는 자연스러움 필요해서 중간값
        max_tokens=300,
    )

    raw = response.choices[0].message.content.strip()
    result = json.loads(raw)
    # JSON 문자열 → dict 변환

    return result
    # 반환값 예: {"verdict": "상대방 잘못", "message_script": "자기야, 많이 서운했어..."}
