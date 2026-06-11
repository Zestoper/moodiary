# DB 테이블 설명 — Moodiary 기준

---

## 테이블 목록

| 테이블 | 모델 파일 | 역할 |
|---|---|---|
| users | models/user.py | 회원 정보 |
| diaries | models/diary.py | 일기 |
| chat_messages | models/chat.py | AI 채팅 메시지 |
| consultations | models/consultation.py | 연애 상담 |
| payments | models/payment.py | 결제 내역 |
| usage_quotas | models/quota.py | AI 기능 사용 횟수 |

---

## users

```
id            INT PK 자동증가
email         VARCHAR(100) UNIQUE NOT NULL     # 중복 불가
username      VARCHAR(50) NOT NULL
hashed_password VARCHAR(255) NOT NULL          # bcrypt 해시
preferences   TEXT NULL                        # JSON: 좋아하는 것/싫어하는 것
is_admin      BOOLEAN DEFAULT FALSE            # True면 /api/admin 접근 가능
credits       INT DEFAULT 0                    # 크레딧 잔액
created_at    DATETIME
updated_at    DATETIME
```

---

## diaries

```
id            INT PK 자동증가
user_id       INT FK → users.id (CASCADE)      # 유저 삭제 시 일기도 삭제
title         VARCHAR(200) NOT NULL
content       TEXT NOT NULL
emotion_tags  VARCHAR(255) NULL                # AI 분석 결과: "기쁨, 설렘"
emotion_score INT NULL                         # 1~5 점수
weather_code  INT NULL                         # WMO 기상코드 (0=맑음, 61=비 등)
temperature   FLOAT NULL                       # 섭씨 기온
solution      TEXT NULL                        # AI 솔루션 (emotion_score <= 2 일 때)
created_at    DATETIME
updated_at    DATETIME
```

---

## chat_messages

```
id            INT PK 자동증가
user_id       INT FK → users.id (CASCADE)
diary_id      INT FK → diaries.id (SET NULL)   # 일기 삭제 시 NULL로 변경
role          VARCHAR(20) NOT NULL              # "user" 또는 "assistant"
content       TEXT NOT NULL
created_at    DATETIME
```

- `diary_id`가 NULL이면 일기 없이 시작한 일반 채팅
- `role`은 Groq API에 대화 기록 전달할 때 그대로 사용

---

## consultations

```
id              INT PK 자동증가
user_id         INT FK → users.id (CASCADE)
situation       TEXT NOT NULL       # 상황 설명
my_action       TEXT NULL           # 내가 한 행동 (선택)
partner_action  TEXT NULL           # 상대방이 한 행동 (선택)
verdict         VARCHAR(50) NULL    # AI 판정: "당신 잘못" / "상대방 잘못" 등
message_script  TEXT NULL           # AI가 생성한 화해 문자
created_at      DATETIME
```

---

## payments

```
id            INT PK 자동증가
user_id       INT NOT NULL index
imp_uid       VARCHAR(100) UNIQUE NOT NULL   # PortOne 결제 고유 ID (중복결제 방지)
merchant_uid  VARCHAR(100) UNIQUE NOT NULL   # 우리 서버 주문 ID
amount        INT NOT NULL                   # 결제 금액(원): 1500 / 2900 / 7900
credits       INT NOT NULL                   # 지급 크레딧: 5 / 10 / 30
status        VARCHAR(20) DEFAULT 'paid'     # 'paid' / 'test'
created_at    DATETIME
```

---

## usage_quotas

```
id        INT PK 자동증가
user_id   INT NOT NULL index
feature   VARCHAR(50) NOT NULL   # 'solution' / 'consult' / 'monthly_report'
year      INT NOT NULL
month     INT NOT NULL           # 1~12
count     INT DEFAULT 0          # 해당 월 사용 횟수

UNIQUE(user_id, feature, year, month)  # 같은 유저+기능+연월은 레코드 하나만
```

무료 한도:
- `solution` → 월 3회
- `consult` → 월 5회
- `monthly_report` → 월 1회

한도 초과 시 크레딧 1개 차감, 크레딧도 없으면 402 에러

---

## 테이블 관계

```
users ──┬── diaries (1:N)
        ├── chat_messages (1:N)
        ├── consultations (1:N)
        ├── payments (1:N)
        └── usage_quotas (1:N)

diaries ──── chat_messages (1:N)
```

- 모든 테이블은 `user_id`로 `users`와 연결됩니다.
- `users` 삭제 시 연결된 모든 데이터 CASCADE 삭제됩니다.
- `diaries` 삭제 시 `chat_messages.diary_id`는 NULL로 변경됩니다 (채팅 기록은 보존).

---

## CASCADE vs SET NULL

```python
# CASCADE: 부모 삭제 시 자식도 같이 삭제
user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))

# SET NULL: 부모 삭제 시 이 컬럼만 NULL로 변경
diary_id = Column(Integer, ForeignKey("diaries.id", ondelete="SET NULL"))
```

일기를 삭제해도 그 일기에서 나눈 채팅 기록은 남겨두기 위해 SET NULL을 씁니다.
