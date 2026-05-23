// ─── 프로필 페이지 ────────────────────────────────────────────────────────────────
// 유저 정보 표시, 닉네임 수정, 아바타 선택, 계정 통계, 잔디 그리드

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../context/ToastContext';
import { getMe } from '../api/auth';
import { getDiaries } from '../api/diary';
import api from '../api/axios'; // 닉네임 수정 API 직접 호출
import BottomNav from '../components/BottomNav';

const CARD_STYLE = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius)',
  padding: '24px 28px',
  boxShadow: 'var(--shadow)',
  border: '1px solid var(--border)',
};

// 선택 가능한 아바타 이모지 목록
const AVATARS = ['🌿', '🌸', '🦊', '🐻', '🌙', '☀️', '🦋', '🌊', '🍀', '🎵', '🔥', '⭐'];

const MUSIC_GENRES = [
  '팝', 'K-POP', '발라드', '힙합', 'R&B', '인디', '재즈', '클래식', '록', 'EDM', '트로트', 'OST',
];

// 관심사 카테고리 (온보딩과 동일)
const CATEGORIES = [
  { key: '음악 듣기',        icon: '🎵' },
  { key: '영화/드라마',      icon: '🎬' },
  { key: '운동/스트레칭',    icon: '💪' },
  { key: '산책/야외활동',    icon: '🌿' },
  { key: '게임',             icon: '🎮' },
  { key: '요리/베이킹',      icon: '🍳' },
  { key: '독서',             icon: '📚' },
  { key: '그림/그리기',      icon: '🎨' },
  { key: '친구/가족과 대화', icon: '💬' },
  { key: '혼자만의 시간',    icon: '🧘' },
  { key: '카페/맛집 탐방',   icon: '☕' },
  { key: '드라이브',         icon: '🚗' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast();

  const [user, setUser] = useState(null);       // 유저 정보 { id, email, username, created_at }
  const [diaries, setDiaries] = useState([]);   // 전체 일기 목록 (통계 계산용)
  const [editingName, setEditingName] = useState(false); // 닉네임 수정 모드
  const [newUsername, setNewUsername] = useState('');    // 수정할 닉네임 입력값
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState(() => localStorage.getItem('profile_avatar') || '🌿');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // 관심사 상태
  const [likes, setLikes] = useState(new Set());
  const [dislikes, setDislikes] = useState(new Set());
  const [musicGenres, setMusicGenres] = useState(new Set());
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // 오늘 날짜
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const today = `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;

  useEffect(() => {
    const load = async () => {
      try {
        const [me, diaryData] = await Promise.all([getMe(), getDiaries()]);
        // Promise.all: 두 API를 동시에 호출. 둘 다 완료될 때까지 기다림 (순차 호출보다 빠름)
        setUser(me);
        setDiaries(diaryData);
        setNewUsername(me.username); // 수정 폼 초기값
      } catch {
        navigate('/login');
      }
    };
    load();
  }, []);

  // ── 통계 계산 ────────────────────────────────────────────────────────────────
  const scoredDiaries = diaries.filter((d) => d.emotion_score);
  const avgScore = scoredDiaries.length > 0
    ? (scoredDiaries.reduce((sum, d) => sum + d.emotion_score, 0) / scoredDiaries.length).toFixed(1)
    : null;

  // 가장 많이 나온 감정 태그 찾기
  const allTags = diaries
    .filter((d) => d.emotion_tags)
    .flatMap((d) => d.emotion_tags.split(',').map((t) => t.trim()));
  const tagCount = {};
  allTags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; });
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0]?.[0];

  // 연속 작성일 계산 (오늘 포함 최근 연속 기록)
  const streak = (() => {
    const writtenDays = new Set(diaries.map((d) => {
      const date = new Date(d.created_at);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }));
    let count = 0;
    const check = new Date();
    while (true) {
      const key = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`;
      if (!writtenDays.has(key)) break;
      count++;
      check.setDate(check.getDate() - 1);
    }
    return count;
  })();

  // user 로드 시 저장된 관심사 파싱
  useEffect(() => {
    if (!user?.preferences) return;
    try {
      const prefs = JSON.parse(user.preferences);
      setLikes(new Set(prefs.likes || []));
      setDislikes(new Set(prefs.dislikes || []));
      setMusicGenres(new Set(prefs.music_genres || []));
    } catch {}
  }, [user]);

  // ── 관심사 토글 ──────────────────────────────────────────────────────────────
  const toggleLike = (key) => {
    setLikes((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
    setDislikes((prev) => { const next = new Set(prev); next.delete(key); return next; });
  };

  const toggleGenre = (g) => {
    setMusicGenres((prev) => { const next = new Set(prev); next.has(g) ? next.delete(g) : next.add(g); return next; });
  };

  const toggleDislike = (key) => {
    setDislikes((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
    setLikes((prev) => { const next = new Set(prev); next.delete(key); return next; });
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const preferences = JSON.stringify({ likes: Array.from(likes), dislikes: Array.from(dislikes), music_genres: Array.from(musicGenres) });
      const res = await api.patch('/api/auth/me', { preferences });
      setUser(res.data);
      setEditingPrefs(false);
      addToast('관심사가 업데이트됐어요', 'success');
    } catch {
      addToast('저장에 실패했어요', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleCancelPrefs = () => {
    setEditingPrefs(false);
    try {
      const prefs = user?.preferences ? JSON.parse(user.preferences) : {};
      setLikes(new Set(prefs.likes || []));
      setDislikes(new Set(prefs.dislikes || []));
      setMusicGenres(new Set(prefs.music_genres || []));
    } catch {}
  };

  // ── 닉네임 저장 ──────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!newUsername.trim()) return;
    setSaving(true);
    try {
      const res = await api.patch('/api/auth/me', { username: newUsername.trim() });
      // PATCH /api/auth/me: 부분 수정. username만 전달
      setUser(res.data);        // 화면의 유저 정보 업데이트
      setEditingName(false);
      addToast('닉네임이 변경됐어요 ✨', 'success');
    } catch {
      addToast('변경에 실패했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  const emotionColor = (score) => {
    if (!score) return 'var(--primary)';
    if (score >= 4) return '#82c9a0';
    if (score <= 2) return '#e08080';
    return '#e0c080';
  };

  const handleAvatarSelect = (emoji) => {
    setAvatar(emoji);
    localStorage.setItem('profile_avatar', emoji);
    setShowAvatarPicker(false);
  };

  // 날짜 객체 → 로컬 시간 기준 "YYYY-MM-DD" (toISOString은 UTC 기준이라 KST 자정 이후 하루 어긋남)
  const toLocalKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  // ── GitHub잔디 스타일 그리드 계산 (최근 91일) ─────────────────────────────────
  const grassGrid = (() => {
    const writtenMap = {};
    diaries.forEach((d) => {
      const key = toLocalKey(new Date(d.created_at)); // 서버 UTC → 로컬 날짜 변환
      if (!writtenMap[key] || d.emotion_score > writtenMap[key]) {
        writtenMap[key] = d.emotion_score || 0;
      }
    });

    const weeks = 13;
    const cells = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (weeks * 7 - 1) - today.getDay());

    for (let w = 0; w < weeks; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        const key = toLocalKey(date);
        week.push({ key, score: writtenMap[key] ?? null, isFuture: date > today });
      }
      cells.push(week);
    }
    return cells;
  })();

  const grassColor = (score, isFuture) => {
    if (isFuture) return 'transparent';
    if (score === null) return 'var(--border)'; // 일기 없음: 회색
    if (score >= 5) return '#6dc09a';
    if (score >= 4) return '#8dcc9e';
    if (score >= 3) return '#e0c080';
    if (score >= 2) return '#e8a070';
    if (score >= 1) return '#e08080';
    return '#a8d8b0'; // score=0 (일기 있지만 점수 없음): 연한 초록
  };

  if (!user) return null; // 로딩 중엔 아무것도 렌더링 안 함

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden' }}>

      {/* ── 네비게이션 ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, padding: '0 24px', height: 56, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/diary')} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '6px 12px', fontSize: 14 }}>
          ← 일기로
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, color: 'var(--primary)' }}>프로필</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{today}</p>
        </div>
        <button onClick={toggleTheme} style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 16, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
          {isDark ? '☀️' : '🌙'}
        </button>
      </nav>

      <div className="page-body mobile-pad" style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── 유저 정보 카드 ── */}
        <div style={CARD_STYLE}>
          {/* 아바타 + 이름 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowAvatarPicker((v) => !v)}
                title="아바타 변경"
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--primary-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, cursor: 'pointer',
                  border: showAvatarPicker ? '2px solid var(--primary)' : '2px solid transparent',
                  transition: 'border 0.15s',
                }}
              >
                {avatar}
              </div>
              {/* 아바타 선택 피커 */}
              {showAvatarPicker && (
                <div style={{
                  position: 'absolute', top: 64, left: 0, zIndex: 10,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: 10,
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}>
                  {AVATARS.map((e) => (
                    <button
                      key={e}
                      onClick={() => handleAvatarSelect(e)}
                      style={{
                        fontSize: 22, padding: '6px 8px', borderRadius: 8, border: 'none',
                        background: avatar === e ? 'var(--primary-light)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                {user.username}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user.email}</p>
            </div>
          </div>

          {/* 닉네임 수정 영역 */}
          {editingName ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                placeholder="새 닉네임"
                style={{ flex: 1 }}
                autoFocus
              />
              <button onClick={handleSaveName} disabled={saving} style={{ padding: '0 20px', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14, borderRadius: 12 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setEditingName(false)} style={{ padding: '0 16px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 14 }}>
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              style={{ padding: '8px 18px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 13, borderRadius: 10 }}
            >
              ✏️ 닉네임 변경
            </button>
          )}

          {/* 가입일 */}
          <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            가입일 · {new Date(user.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* ── 나의 통계 ── */}
        <div style={CARD_STYLE}>
          <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 17, marginBottom: 16, color: 'var(--text)' }}>
            나의 기록
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>

            {/* 총 일기 수 */}
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>총 일기</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif' }}>
                {diaries.length}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>개</p>
            </div>

            {/* 연속 작성일 */}
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>연속 작성</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: streak > 0 ? '#82c9a0' : 'var(--text-muted)', fontFamily: 'Nanum Myeongjo, serif' }}>
                {streak}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {streak > 0 ? '일째 🔥' : '일째'}
              </p>
            </div>

            {/* 평균 감정 점수 */}
            {avgScore && (
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>평균 감정</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: emotionColor(Math.round(Number(avgScore))), fontFamily: 'Nanum Myeongjo, serif' }}>
                  {avgScore}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>점</p>
              </div>
            )}

            {/* 대표 감정 */}
            {topTag && (
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>대표 감정</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif' }}>
                  {topTag}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tagCount[topTag]}회</p>
              </div>
            )}

          </div>
        </div>

        {/* ── 감정 잔디 그리드 ── */}
        {diaries.length > 0 && (
          <div style={CARD_STYLE}>
            <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 17, marginBottom: 4, color: 'var(--text)' }}>
              나의 감정 잔디
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>최근 13주 일기 작성 기록</p>
            {/* 요일 레이블 */}
            <div style={{ display: 'flex', gap: 3, marginBottom: 4, paddingLeft: 4 }}>
              {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                <div key={d} style={{ width: 14, fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', flex: '0 0 14px' }}>{d}</div>
              ))}
            </div>
            {/* 잔디 셀 그리드 (가로: 요일, 세로: 주차) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {grassGrid.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', gap: 3 }}>
                  {week.map(({ key, score, isFuture }) => (
                    <div
                      key={key}
                      title={score !== null ? `${key} · ${score || '?'}점` : key}
                      style={{
                        width: 14, height: 14, borderRadius: 3, flex: '0 0 14px',
                        background: grassColor(score, isFuture),
                        border: isFuture ? 'none' : '1px solid rgba(0,0,0,0.06)',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
            {/* 범례 */}
            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>감정:</span>
              {[
                { color: '#e08080', label: '1점' }, { color: '#e8a070', label: '2점' },
                { color: '#e0c080', label: '3점' }, { color: '#8dcc9e', label: '4점' },
                { color: '#6dc09a', label: '5점' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 관심사 설정 ── */}
        <div style={CARD_STYLE}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingPrefs ? 16 : 0 }}>
            <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 17, color: 'var(--text)' }}>관심사</h3>
            {!editingPrefs && (
              <button onClick={() => setEditingPrefs(true)} style={{ padding: '6px 14px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 13, borderRadius: 10 }}>
                ✏️ 수정
              </button>
            )}
          </div>

          {!editingPrefs ? (
            <div>
              {likes.size > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>좋아하는 것</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Array.from(likes).map((key) => {
                      const cat = CATEGORIES.find((c) => c.key === key);
                      return (
                        <span key={key} style={{ padding: '5px 12px', background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: 20, fontSize: 13 }}>
                          {cat?.icon} {key}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {dislikes.size > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>싫어하는 것</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Array.from(dislikes).map((key) => {
                      const cat = CATEGORIES.find((c) => c.key === key);
                      return (
                        <span key={key} style={{ padding: '5px 12px', background: '#fde8e8', color: '#e07070', borderRadius: 20, fontSize: 13 }}>
                          {cat?.icon} {key}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {musicGenres.size > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>음악 장르</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Array.from(musicGenres).map((g) => (
                      <span key={g} style={{ padding: '5px 12px', background: '#e8eef8', color: '#5070a0', borderRadius: 20, fontSize: 13 }}>
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {likes.size === 0 && dislikes.size === 0 && musicGenres.size === 0 && (
                <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>아직 관심사를 설정하지 않았어요.</p>
              )}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>좋아하는 것</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map(({ key, icon }) => {
                    const sel = likes.has(key);
                    return (
                      <button key={key} onClick={() => toggleLike(key)} style={{ padding: '7px 13px', borderRadius: 20, fontSize: 12, background: sel ? 'var(--primary)' : 'var(--bg)', color: sel ? 'white' : 'var(--text)', border: sel ? '1px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {icon} {key}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                  싫어하는 것 <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(선택 사항)</span>
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map(({ key, icon }) => {
                    const sel = dislikes.has(key);
                    return (
                      <button key={key} onClick={() => toggleDislike(key)} style={{ padding: '7px 13px', borderRadius: 20, fontSize: 12, background: sel ? '#fde8e8' : 'var(--bg)', color: sel ? '#e07070' : 'var(--text)', border: sel ? '1px solid #e08080' : '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {icon} {key}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                  음악 장르 <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(선택 사항)</span>
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {MUSIC_GENRES.map((g) => {
                    const sel = musicGenres.has(g);
                    return (
                      <button key={g} onClick={() => toggleGenre(g)} style={{ padding: '7px 13px', borderRadius: 20, fontSize: 12, background: sel ? '#7090c0' : 'var(--bg)', color: sel ? 'white' : 'var(--text)', border: sel ? '1px solid #7090c0' : '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSavePrefs} disabled={savingPrefs} style={{ flex: 1, padding: '12px 0', background: 'var(--primary)', color: 'white', fontWeight: 600, borderRadius: 12 }}>
                  {savingPrefs ? '저장 중...' : '저장하기'}
                </button>
                <button onClick={handleCancelPrefs} style={{ padding: '12px 20px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 로그아웃 ── */}
        <button
          onClick={logout}
          style={{ padding: '14px 0', background: '#fde8e8', color: '#e07070', fontWeight: 600, fontSize: 15, borderRadius: 14 }}
        >
          로그아웃
        </button>

      </div>
      <BottomNav />
    </div>
  );
}
