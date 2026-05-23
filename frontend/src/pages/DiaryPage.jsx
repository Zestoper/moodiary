import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDiaries, createDiary, updateDiary, deleteDiary, getSolution } from '../api/diary';
import { PERSONA_CONFIRM } from '../constants/persona';
import { getMe } from '../api/auth';
import { getMusicRecommendation } from '../api/music';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../context/ToastContext';
import BottomNav from '../components/BottomNav';

// ── WMO 날씨 코드 → 이모지/설명 매핑 ────────────────────────────────────────────
// WMO: 세계기상기구 표준 날씨 코드. Open-Meteo API가 이 코드를 반환함
const WMO = {
  0: { emoji: '☀️', text: '맑음' }, 1: { emoji: '🌤️', text: '대체로 맑음' },
  2: { emoji: '⛅', text: '구름 조금' }, 3: { emoji: '☁️', text: '흐림' },
  45: { emoji: '🌫️', text: '안개' }, 48: { emoji: '🌫️', text: '안개' },
  51: { emoji: '🌦️', text: '이슬비' }, 53: { emoji: '🌦️', text: '이슬비' }, 55: { emoji: '🌧️', text: '이슬비' },
  61: { emoji: '🌧️', text: '비' }, 63: { emoji: '🌧️', text: '비' }, 65: { emoji: '🌧️', text: '폭우' },
  71: { emoji: '❄️', text: '눈' }, 73: { emoji: '❄️', text: '눈' }, 75: { emoji: '❄️', text: '폭설' },
  77: { emoji: '🌨️', text: '싸락눈' },
  80: { emoji: '🌦️', text: '소나기' }, 81: { emoji: '🌦️', text: '소나기' }, 82: { emoji: '🌧️', text: '강한 소나기' },
  95: { emoji: '⛈️', text: '뇌우' }, 96: { emoji: '⛈️', text: '뇌우' }, 99: { emoji: '⛈️', text: '뇌우' },
};

// ── AI 페르소나 목록 ───────────────────────────────────────────────────────────────
const AI_PERSONAS = [
  { key: 'friend',      emoji: '🌿', name: '친구',   desc: '공감하며 반말로' },
  { key: 'mentor',      emoji: '📚', name: '선배',   desc: '따뜻한 조언' },
  { key: 'counselor',   emoji: '🧠', name: '상담사', desc: '전문적·존댓말' },
  { key: 'cheerleader', emoji: '🎉', name: '응원단', desc: '무조건 긍정!' },
  { key: 'simsimi',     emoji: '🤪', name: '심심이', desc: '엉뚱하고 위트 있게' },
  { key: 'realist',    emoji: '🔥', name: '현실러', desc: '팩트로 직격' },
];

// ── 글쓰기 프롬프트 목록 (30개) ───────────────────────────────────────────────────
const PROMPTS = [
  '오늘 가장 기억에 남는 대화는?', '지금 가장 고마운 사람은 누구인가요?',
  '오늘 가장 힘들었던 순간, 어떻게 넘겼나요?', '나 자신에게 칭찬해주고 싶은 것은?',
  '요즘 머릿속을 가장 많이 차지하는 생각은?', '오늘 처음 해본 것이 있나요?',
  '지금 당장 가고 싶은 장소는? 왜?', '오늘 느낀 감정 중 가장 강렬했던 것은?',
  '한 달 뒤의 나에게 하고 싶은 말은?', '오늘 하루를 색깔로 표현한다면?',
  '최근에 새로 배운 것이 있나요?', '지금 나를 행복하게 만드는 작은 것들은?',
  '오늘 스스로에게 가장 솔직했던 순간은?', '요즘 가장 걱정되는 것은?',
  '오늘 내가 내린 가장 중요한 선택은?', '지금 가장 듣고 싶은 말은?',
  '오늘 나의 에너지를 가장 많이 쏟은 곳은?', '올해 꼭 이루고 싶은 한 가지는?',
  '오늘 나를 웃게 만든 것은?', '지금 나에게 가장 필요한 것은?',
  '오늘 처음으로 깨달은 것이 있다면?', '요즘 가장 보고 싶은 사람은?',
  '나만의 스트레스 해소법은?', '오늘 다시 돌아간다면 바꾸고 싶은 순간이 있나요?',
  '지금 마음 상태를 날씨로 표현한다면?', '요즘 나에게 가장 큰 위로가 되는 것은?',
  '오늘 내가 보여준 모습이 마음에 드나요?', '지금 가장 설레는 것은?',
  '오늘 하루를 한 줄로 요약한다면?', '지금 이 순간 어떤 기분인가요?',
];

const NAV_STYLE = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 16px', background: 'var(--surface)',
  borderBottom: '1px solid var(--border)', marginBottom: 0,
  position: 'sticky', top: 0, zIndex: 100,
};

const CARD_STYLE = {
  background: 'var(--surface)', borderRadius: 'var(--radius)',
  padding: '20px 24px', boxShadow: 'var(--shadow)',
  border: '1px solid var(--border)', cursor: 'pointer',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
};

export default function DiaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, refreshUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast(); // 알림 함수

  const [diaries, setDiaries] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // 현재 상세 보기 중인 일기
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // 인라인 삭제 확인 중인 일기 ID
  const [username, setUsername] = useState('');
  const [search, setSearch] = useState('');
  // search: 검색어. 실시간으로 diaries 배열 필터링에 사용

  // 수정 모드 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // 음성 입력 상태
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // 초안 자동저장 상태
  const [draftRestored, setDraftRestored] = useState(false); // 초안 복원 알림 표시 여부
  const draftTimerRef = useRef(null); // debounce 타이머

  // 날씨 상태 (일기 작성 폼 열릴 때 자동으로 가져옴)
  const [weatherInfo, setWeatherInfo] = useState(null);
  // weatherInfo: { code: 0, temperature: 21.3, emoji: '☀️', text: '맑음' } | null

  // 글쓰기 프롬프트 상태
  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  // 새로고침마다 다른 프롬프트로 시작

  // AI 페르소나 선택 (localStorage에 저장해서 ChatPage와 공유)
  const [persona, setPersona] = useState(() => localStorage.getItem('ai_persona') || 'friend');

  useEffect(() => {
    localStorage.setItem('ai_persona', persona);
  }, [persona]);

  // 폼 열릴 때 저장된 초안 복원
  useEffect(() => {
    if (!showForm) return;
    const saved = localStorage.getItem('diary_draft');
    if (!saved) return;
    try {
      const { title: t, content: c } = JSON.parse(saved);
      if (t || c) {
        setTitle(t || '');
        setContent(c || '');
        setDraftRestored(true);
        // 3초 후 알림 숨김
        setTimeout(() => setDraftRestored(false), 3000);
      }
    } catch {}
  }, [showForm]);

  // 제목/내용 변경 시 500ms 후 localStorage에 초안 저장 (debounce)
  useEffect(() => {
    if (!showForm) return;
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (title || content) {
        localStorage.setItem('diary_draft', JSON.stringify({ title, content }));
      }
    }, 500);
    return () => clearTimeout(draftTimerRef.current);
  }, [title, content, showForm]);

  // 음악 추천 상태
  const [music, setMusic] = useState(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicGenres, setMusicGenres] = useState([]);  // 유저 선호 장르
  const [solutionLoading, setSolutionLoading] = useState(false);

  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const today = `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;

  useEffect(() => {
    fetchDiaries();
  }, []);

  // 캘린더에서 넘어올 때 location.state.openId로 해당 일기 자동 선택
  useEffect(() => {
    const openId = location.state?.openId;
    if (!openId || diaries.length === 0) return;
    const target = diaries.find((d) => d.id === openId);
    if (target) setSelected(target);
  }, [diaries, location.state?.openId]);
  useEffect(() => {
    const loadUser = async () => {
      try {
        const me = await getMe();
        setUsername(me.username);
        if (me.preferences) {
          try {
            const prefs = JSON.parse(me.preferences);
            setMusicGenres(prefs.music_genres || []);
          } catch {}
        }
        // 크레딧·관리자 여부 등 최신 유저 정보를 auth context에도 반영
        refreshUser();
      } catch { }
    };
    loadUser();
  }, []);

  // 일기 선택 시 음악 추천 자동 fetch
  useEffect(() => {
    if (!selected?.emotion_score) { setMusic(null); return; }
    const fetchMusic = async () => {
      setMusicLoading(true);
      try {
        const data = await getMusicRecommendation(selected.emotion_score, selected.emotion_tags, musicGenres);
        setMusic(data);
      } catch { setMusic(null); }
      finally { setMusicLoading(false); }
    };
    fetchMusic();
  }, [selected]);

  const fetchDiaries = async () => {
    try {
      const data = await getDiaries();
      setDiaries(data);
    } catch { navigate('/login'); }
  };

  // ── 날씨 자동 기록 ──────────────────────────────────────────────────────────────
  const fetchWeather = () => {
    if (!navigator.geolocation) return; // 브라우저 미지원 시 무시
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          // Open-Meteo: 무료, API 키 불필요. current에 원하는 필드 명시
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code`;
          const res = await fetch(url);
          const json = await res.json();
          const code = json.current.weather_code;
          const temp = Math.round(json.current.temperature_2m);
          setWeatherInfo({ code, temperature: temp, ...(WMO[code] || { emoji: '🌡️', text: '날씨' }) });
        } catch { /* 날씨 실패해도 일기 작성은 계속 가능 */ }
      },
      () => { /* 위치 권한 거부도 무시 */ },
      { timeout: 5000 },
    );
  };

  // ── 검색 필터 ─────────────────────────────────────────────────────────────────
  const filteredDiaries = diaries.filter((d) => {
    if (!search.trim()) return true; // 검색어 없으면 전체 표시
    const q = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q) ||
      (d.emotion_tags && d.emotion_tags.toLowerCase().includes(q))
    );
    // 제목 / 본문 / 감정 태그 중 하나라도 검색어 포함하면 표시
    // toLowerCase(): 대소문자 구분 없이 검색
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title || !content) return;
    stopListening(); // 저장 시 음성 입력 중이면 종료
    setLoading(true);
    try {
      const newDiary = await createDiary(title, content, weatherInfo?.code ?? null, weatherInfo?.temperature ?? null);
      setDiaries([newDiary, ...diaries]);
      setTitle(''); setContent(''); setShowForm(false); setWeatherInfo(null); setSearch('');
      localStorage.removeItem('diary_draft'); // 저장 완료 → 초안 삭제
      addToast('일기가 저장됐어요 🌿', 'success');
    } catch {
      addToast('저장에 실패했어요', 'error');
    } finally { setLoading(false); }
  };

  const handleDelete = async (diaryId) => {
    try {
      await deleteDiary(diaryId);
      setDiaries(diaries.filter((d) => d.id !== diaryId));
      if (selected?.id === diaryId) setSelected(null);
      setConfirmDeleteId(null);
      addToast('일기가 삭제됐어요', 'info');
    } catch {
      addToast('삭제에 실패했어요', 'error');
    }
  };

  // ── 수정 시작: 폼에 기존 값 채우기 ──────────────────────────────────────────
  const handleEditStart = () => {
    setEditTitle(selected.title);     // 기존 제목 미리 채움
    setEditContent(selected.content); // 기존 본문 미리 채움
    setIsEditing(true);               // 수정 모드로 전환
  };

  // ── 수정 저장 ─────────────────────────────────────────────────────────────────
  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editTitle || !editContent) return;
    stopListening(); // 저장 시 음성 입력 중이면 종료
    setLoading(true);
    try {
      const updated = await updateDiary(selected.id, editTitle, editContent);
      setDiaries(diaries.map((d) => d.id === updated.id ? updated : d));
      setSelected(updated);
      setIsEditing(false);
      addToast('일기가 수정됐어요 ✏️', 'success');
    } catch {
      addToast('수정에 실패했어요', 'error');
    } finally { setLoading(false); }
  };

  // ── 맞춤 솔루션 요청 ──────────────────────────────────────────────────────────
  const handleGetSolution = async () => {
    setSolutionLoading(true);
    try {
      const updated = await getSolution(selected.id);
      setSelected(updated);
      setDiaries(diaries.map((d) => d.id === updated.id ? updated : d));
    } catch (e) {
      if (e?.response?.status === 402) {
        addToast('이번 달 무료 횟수를 모두 사용했어요. 크레딧을 충전해주세요.', 'error');
        navigate('/payment');
      } else {
        addToast('솔루션 생성에 실패했어요', 'error');
      }
    } finally {
      setSolutionLoading(false);
    }
  };

  // ── 음성 입력 ─────────────────────────────────────────────────────────────────
  const handleVoiceToggle = (setter) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast('이 브라우저는 음성 입력을 지원하지 않아요 (Chrome 권장)', 'error');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      // stop()을 호출하면 recognition.onend가 자동으로 실행되어 setIsListening(false)가 호출됨
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';      // 한국어 인식
    recognition.continuous = true;   // 말을 멈춰도 자동 종료 안 함
    recognition.interimResults = false; // 최종 인식 결과만 받음 (중간 결과 제외)
    recognition.onresult = (e) => {
      // e.results: 인식된 결과 배열. 마지막 결과만 추가
      const transcript = e.results[e.results.length - 1][0].transcript;
      setter((prev) => prev + (prev.endsWith('\n') || prev === '' ? '' : ' ') + transcript);
      // 기존 내용 뒤에 공백 한 칸 추가 후 인식된 텍스트 이어붙임
    };
    recognition.onerror = () => {
      addToast('음성 인식에 실패했어요', 'error');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // ── PDF 내보내기 ──────────────────────────────────────────────────────────────
  const escapeHtml = (str) =>
    // XSS 방지: 일기 내용에 HTML 특수문자가 있어도 안전하게 출력
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const handleExportPDF = (diary) => {
    const date = new Date(diary.created_at).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const tagsLine = diary.emotion_tags
      ? `<p class="tags">🎭 ${escapeHtml(diary.emotion_tags)}${diary.emotion_score ? ` · ${diary.emotion_score}점` : ''}</p>`
      : '';
    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${escapeHtml(diary.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Nanum Myeongjo', serif; max-width: 580px; margin: 60px auto; color: #2d2016; line-height: 1.9; }
    h1 { font-size: 26px; border-bottom: 1px solid #e0d0c0; padding-bottom: 12px; margin-bottom: 6px; }
    .meta { color: #999; font-size: 13px; margin-bottom: 28px; }
    .content { font-size: 16px; white-space: pre-wrap; }
    .tags { margin-top: 32px; padding: 10px 16px; background: #fdf6f0; border-radius: 8px; font-size: 13px; color: #b07040; }
    .brand { margin-top: 48px; text-align: right; color: #ccc; font-size: 12px; }
  </style>
</head><body>
  <h1>${escapeHtml(diary.title)}</h1>
  <p class="meta">${date}</p>
  <p class="content">${escapeHtml(diary.content).replace(/\n/g, '<br>')}</p>
  ${tagsLine}
  <p class="brand">Moodiary</p>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body></html>`;
    // window.open으로 새 탭을 열고 HTML을 직접 작성 후 print 트리거
    // 브라우저 인쇄 대화상자에서 "PDF로 저장" 선택 → 파일로 저장됨
    // 별도 라이브러리 없이 한글 폰트도 완벽 지원
    // Blob URL 방식: document.write 없이 HTML 파일을 직접 새 탭에서 열기
    // URL.createObjectURL → 브라우저 메모리에 임시 파일 생성 → window.open으로 열기
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank', 'width=700,height=900');
    if (!win) { addToast('팝업이 차단됐어요. 팝업 허용 후 다시 시도해줘요', 'error'); return; }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000); // 5초 후 메모리 해제
  };

  const emotionColor = (score) => {
    if (!score) return '#ccc';
    if (score >= 4) return '#82c9a0';
    if (score <= 2) return '#e08080';
    return '#e0c080';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── 네비게이션 ── */}
      <nav style={NAV_STYLE}>
        <div>
          <h1
            onClick={() => { setSelected(null); setShowForm(false); stopListening(); setWeatherInfo(null); }}
            style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 22, color: 'var(--primary)', cursor: 'pointer' }}
          >
            🌿 Moodiary
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            {username ? `안녕, ${username}님` : '안녕하세요'} · {today}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* 데스크탑 전용 메뉴 */}
          <div className="desktop-only" style={{ gap: 6, alignItems: 'center' }}>
            <button onClick={() => navigate('/calendar')} style={{ padding: '7px 14px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: 13 }}>캘린더</button>
            <button onClick={() => navigate('/chat')} style={{ padding: '7px 14px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: 13 }}>AI 채팅</button>
            <button onClick={() => navigate('/consult')} style={{ padding: '7px 14px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: 13 }}>연애 상담</button>
            <button onClick={() => navigate('/profile')} style={{ padding: '7px 14px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: 13 }}>프로필</button>
            <button onClick={() => navigate('/payment')} style={{ padding: '7px 14px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: 13 }}>
              크레딧 {user?.credits ?? 0}개
            </button>
            {user?.is_admin && (
              <button onClick={() => navigate('/admin')} style={{ padding: '7px 14px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: 13 }}>관리자</button>
            )}
          </div>
          {/* 모바일에서도 표시 */}
          <button onClick={toggleTheme} style={{ padding: '7px 10px', background: 'transparent', color: 'var(--text-muted)', fontSize: 16, border: '1px solid var(--border)', borderRadius: 10 }}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <button onClick={logout} style={{ padding: '7px 14px', background: 'transparent', color: 'var(--text-muted)', fontSize: 13 }}>로그아웃</button>
        </div>
      </nav>

      <div className="page-body mobile-pad" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        {selected ? (
          /* ── 일기 상세 보기 / 수정 ── */
          <div>
            <button onClick={() => { setSelected(null); setIsEditing(false); }} style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 14, padding: '4px 0', marginBottom: 20 }}>
              ← 목록으로
            </button>

            {isEditing ? (
              /* ── 수정 폼 ── */
              <form onSubmit={handleEditSave} style={{ ...CARD_STYLE, cursor: 'default' }}>
                <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', marginBottom: 16 }}>일기 수정</h3>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="제목"
                  style={{ marginBottom: 12 }}
                />
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    style={{ paddingBottom: 40, marginBottom: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleVoiceToggle(setEditContent)}
                    title={isListening ? '음성 입력 중지' : '음성으로 입력'}
                    style={{
                      position: 'absolute', bottom: 10, right: 10,
                      padding: '5px 11px', fontSize: 16, borderRadius: 10,
                      background: isListening ? '#e08080' : 'var(--primary-light)',
                      color: isListening ? 'white' : 'var(--primary-dark)',
                      border: 'none', cursor: 'pointer',
                      animation: isListening ? 'blink 1s step-end infinite' : 'none',
                    }}
                  >
                    🎤
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={loading} style={{ flex: 1, padding: '13px 0', background: 'var(--primary)', color: 'white', fontWeight: 600 }}>
                    {loading ? '저장 중...' : '저장하기'}
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '13px 20px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    취소
                  </button>
                </div>
              </form>
            ) : (
              /* ── 상세 보기 ── */
              <>
                <div style={{ ...CARD_STYLE, cursor: 'default' }}>
                  <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 22, marginBottom: 8 }}>{selected.title}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                    {new Date(selected.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p style={{ lineHeight: 1.9, whiteSpace: 'pre-wrap', marginBottom: 24 }}>{selected.content}</p>
                  {selected.emotion_tags && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--bg)', borderRadius: 12 }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{selected.emotion_tags}</span>
                      <span style={{ marginLeft: 'auto', background: emotionColor(selected.emotion_score), color: 'white', padding: '2px 10px', borderRadius: 20, fontSize: 13 }}>
                        {selected.emotion_score}점
                      </span>
                    </div>
                  )}
                </div>
                {/* ── 맞춤 솔루션 ── */}
                {!selected.emotion_score && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>AI가 감정을 분석하지 못했어요. 일기를 수정하면 다시 분석됩니다.</p>
                  </div>
                )}
                {selected.emotion_score <= 2 && (
                  <div style={{ marginTop: 16, padding: '16px 20px', background: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 10 }}>감정이 많이 힘드셨군요</p>
                    {selected.solution ? (
                      <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selected.solution}</p>
                    ) : (
                      <button
                        onClick={handleGetSolution}
                        disabled={solutionLoading}
                        style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, borderRadius: 10 }}
                      >
                        {solutionLoading ? '생성 중...' : '맞춤 솔루션 받기'}
                      </button>
                    )}
                  </div>
                )}

                {/* ── 음악 추천 ── */}
                {musicLoading && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '16px 0 0' }}>🎵 감정에 맞는 플레이리스트 찾는 중...</p>
                )}
                {music?.playlists?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>🎵 이 감정에 어울리는 플레이리스트</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {music.playlists.map((p) => (
                        <a
                          key={p.id}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', background: 'var(--bg)',
                            border: '1px solid var(--border)', borderRadius: 10,
                            textDecoration: 'none', color: 'var(--text)', fontSize: 12, flex: 1, minWidth: 140,
                          }}
                        >
                          {p.image && <img src={p.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {music?.configured === false && selected?.emotion_score && (
                  // YouTube API 키 없을 때 → 직접 YouTube 검색 링크 제공
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>감정에 어울리는 음악 찾기</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(() => {
                        const moodKo = selected.emotion_tags?.split(',')[0] || (selected.emotion_score >= 4 ? '기쁨' : selected.emotion_score <= 2 ? '힐링' : '감성');
                        const moodEn = selected.emotion_score >= 4 ? 'happy' : selected.emotion_score <= 2 ? 'healing sad' : 'chill';
                        const genre = musicGenres[0] || '';
                        return [
                          { label: '플레이리스트', query: `${moodKo}${genre ? ' ' + genre : ''} 음악 플레이리스트` },
                          { label: 'lo-fi', query: `lofi ${moodEn}${genre ? ' ' + genre : ''} music` },
                        ];
                      })().map(({ label, query }) => (
                        <a
                          key={label}
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', background: 'var(--bg)',
                            border: '1px solid var(--border)', borderRadius: 10,
                            textDecoration: 'none', color: 'var(--text)', fontSize: 13,
                          }}
                        >
                          {label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  <button onClick={() => navigate(`/chat?diary_id=${selected.id}`)} style={{ flex: '1 1 auto', padding: '12px 0', background: 'var(--primary)', color: 'white', fontWeight: 600, minWidth: 120 }}>이 일기로 AI 채팅</button>
                  <button onClick={() => handleExportPDF(selected)} style={{ padding: '12px 16px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 600 }} title="PDF로 저장">📄</button>
                  <button onClick={handleEditStart} style={{ padding: '12px 20px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 600 }}>✏️ 수정</button>
                  {confirmDeleteId === selected.id ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
                        {(PERSONA_CONFIRM[persona] || PERSONA_CONFIRM.friend).deleteMsg}
                      </span>
                      <button onClick={() => handleDelete(selected.id)} style={{ padding: '12px 16px', background: '#e08080', color: 'white', fontWeight: 600 }}>
                        {(PERSONA_CONFIRM[persona] || PERSONA_CONFIRM.friend).confirmBtn}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '12px 16px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {(PERSONA_CONFIRM[persona] || PERSONA_CONFIRM.friend).cancelBtn}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(selected.id)} style={{ padding: '12px 20px', background: '#fde8e8', color: '#e07070' }}>삭제</button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* ── 일기 목록 ── */
          <div>
            {/* ── AI 페르소나 선택 카드 ── */}
            <div style={{ ...CARD_STYLE, cursor: 'default', marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>💬 AI 채팅 말투 선택</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AI_PERSONAS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      setPersona(p.key);
                      localStorage.setItem('ai_persona', p.key); // 즉시 저장 (useEffect 대기 없이)
                    }}
                    style={{
                      flex: '1 0 auto',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: persona === p.key ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: persona === p.key ? 'var(--primary-light)' : 'var(--bg)',
                      color: persona === p.key ? 'var(--primary-dark)' : 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 2 }}>{p.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: persona === p.key ? 600 : 400 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                나의 일기
                {diaries.length > 0 && (
                  <span style={{ fontSize: 13, background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '2px 10px', borderRadius: 20, fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {diaries.length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => {
                  if (showForm) {
                    stopListening();
                    setWeatherInfo(null);
                    setTitle('');
                    setContent('');
                    localStorage.removeItem('diary_draft'); // 취소 시 초안 삭제
                  } else {
                    fetchWeather();
                  }
                  setShowForm(!showForm);
                }}
                style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', fontWeight: 600 }}
              >
                {showForm ? '취소' : '+ 새 일기'}
              </button>
            </div>

            {/* ── 검색창 ── */}
            {diaries.length > 0 && (
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
                {/* 검색 아이콘. pointerEvents: 'none': 아이콘이 input 클릭을 가로막지 않게 */}
                <input
                  type="text"
                  placeholder="제목, 내용, 감정 태그로 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 40 }} // 아이콘 공간 확보
                />
              </div>
            )}

            {/* ── 일기 작성 폼 ── */}
            {showForm && (
              <form onSubmit={handleCreate} style={{ ...CARD_STYLE, cursor: 'default', marginBottom: 24 }}>
                {/* 초안 복원 알림 */}
                {draftRestored && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--primary-dark)' }}>이전에 작성하던 초안을 불러왔어요</span>
                    <button
                      type="button"
                      onClick={() => { setTitle(''); setContent(''); localStorage.removeItem('diary_draft'); setDraftRestored(false); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-dark)', fontSize: 12, padding: '0 4px' }}
                    >
                      지우기
                    </button>
                  </div>
                )}
                {/* 헤더 행: 제목 + 날씨 배지 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontFamily: 'Nanum Myeongjo, serif' }}>오늘 하루를 기록해요</h3>
                  {weatherInfo && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg)', padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
                      {weatherInfo.emoji} {weatherInfo.text} {weatherInfo.temperature}°C
                    </span>
                  )}
                </div>
                {/* 글쓰기 프롬프트 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>✍️ {PROMPTS[promptIdx]}</span>
                  <button
                    type="button"
                    onClick={() => setPromptIdx(Math.floor(Math.random() * PROMPTS.length))}
                    style={{ fontSize: 16, background: 'transparent', color: 'var(--text-muted)', padding: '2px 6px', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                    title="다른 질문"
                  >
                    🎲
                  </button>
                </div>
                <input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} />
                {/* textarea를 relative 컨테이너로 감싸서 마이크 버튼을 우하단에 절대 위치로 배치 */}
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <textarea
                    placeholder="오늘 어떤 하루였나요?"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    style={{ paddingBottom: 40, marginBottom: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleVoiceToggle(setContent)}
                    title={isListening ? '음성 입력 중지' : '음성으로 입력'}
                    style={{
                      position: 'absolute', bottom: 10, right: 10,
                      padding: '5px 11px', fontSize: 16, borderRadius: 10,
                      background: isListening ? '#e08080' : 'var(--primary-light)',
                      color: isListening ? 'white' : 'var(--primary-dark)',
                      border: 'none', cursor: 'pointer',
                      animation: isListening ? 'blink 1s step-end infinite' : 'none',
                      // blink: 녹음 중임을 시각적으로 표시 (index.css에 정의된 keyframes 재활용)
                    }}
                  >
                    🎤
                  </button>
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px 0', background: 'var(--primary)', color: 'white', fontWeight: 600 }}>
                  {loading ? '감정 분석 중...' : '저장하기'}
                </button>
              </form>
            )}

            {/* ── 일기 목록 ── */}
            {filteredDiaries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>{search ? '🔍' : '📔'}</div>
                <p>{search ? `"${search}" 검색 결과가 없어요` : '아직 일기가 없어요. 첫 일기를 써보세요!'}</p>
                {/* 검색 중이면 "검색 결과 없음", 아니면 "일기 없음" 문구 */}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredDiaries.map((diary) => (
                  <div key={diary.id} style={CARD_STYLE} onClick={() => setSelected(diary)}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(180,120,80,0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 17, marginBottom: 4 }}>{diary.title}</h3>
                      {diary.emotion_score && (
                        <span style={{ background: emotionColor(diary.emotion_score), color: 'white', padding: '2px 10px', borderRadius: 20, fontSize: 12, whiteSpace: 'nowrap', marginLeft: 12 }}>
                          {diary.emotion_score}점
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
                      {new Date(diary.created_at).toLocaleDateString('ko-KR')}
                    </p>
                    {diary.emotion_tags && (
                      <p style={{ color: 'var(--primary)', fontSize: 13 }}>{diary.emotion_tags}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
