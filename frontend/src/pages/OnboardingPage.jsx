// ─── 온보딩 설문 페이지 ────────────────────────────────────────────────────────────
// 회원가입 직후 1회 표시. 좋아하는 것 / 싫어하는 것 선택 → 감정 낮을 때 맞춤 솔루션에 활용

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const MUSIC_GENRES = [
  '팝', 'K-POP', '발라드', '힙합', 'R&B', '인디', '재즈', '클래식', '록', 'EDM', '트로트', 'OST',
];

const CATEGORIES = [
  { key: '음악 듣기',      icon: '🎵' },
  { key: '영화/드라마',    icon: '🎬' },
  { key: '운동/스트레칭',  icon: '💪' },
  { key: '산책/야외활동',  icon: '🌿' },
  { key: '게임',           icon: '🎮' },
  { key: '요리/베이킹',   icon: '🍳' },
  { key: '독서',           icon: '📚' },
  { key: '그림/그리기',   icon: '🎨' },
  { key: '친구/가족과 대화', icon: '💬' },
  { key: '혼자만의 시간', icon: '🧘' },
  { key: '카페/맛집 탐방', icon: '☕' },
  { key: '드라이브',       icon: '🚗' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [likes, setLikes] = useState(new Set());
  const [dislikes, setDislikes] = useState(new Set());
  const [musicGenres, setMusicGenres] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const toggleLike = (key) => {
    setLikes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    // 좋아하는 것에 추가하면 싫어하는 것에서 제거
    setDislikes((prev) => { const next = new Set(prev); next.delete(key); return next; });
  };

  const toggleDislike = (key) => {
    setDislikes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setLikes((prev) => { const next = new Set(prev); next.delete(key); return next; });
  };

  const toggleGenre = (g) => {
    setMusicGenres((prev) => { const next = new Set(prev); next.has(g) ? next.delete(g) : next.add(g); return next; });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preferences = JSON.stringify({
        likes: Array.from(likes),
        dislikes: Array.from(dislikes),
        music_genres: Array.from(musicGenres),
      });
      await api.patch('/api/auth/me', { preferences });
    } catch { /* 저장 실패해도 진행 */ }
    navigate('/diary');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowX: 'hidden' }}>
      <div className="auth-card" style={{ width: '100%', maxWidth: 520, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '40px 36px', boxShadow: 'var(--shadow)' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🌱</div>
          <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 22, color: 'var(--primary)', marginBottom: 8 }}>
            나에 대해 알려주세요
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
            감정이 힘들 때 딱 맞는 활동을 추천해드릴게요.<br />
            나중에 프로필에서 언제든 바꿀 수 있어요.
          </p>
        </div>

        {/* 좋아하는 것 */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            좋아하는 것 <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>(여러 개 선택 가능)</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(({ key, icon }) => {
              const selected = likes.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleLike(key)}
                  style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13,
                    background: selected ? 'var(--primary)' : 'var(--bg)',
                    color: selected ? 'white' : 'var(--text)',
                    border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {icon} {key}
                </button>
              );
            })}
          </div>
        </div>

        {/* 싫어하는 것 */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            싫어하거나 하기 싫은 것 <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>(선택 사항)</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(({ key, icon }) => {
              const selected = dislikes.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleDislike(key)}
                  style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13,
                    background: selected ? '#fde8e8' : 'var(--bg)',
                    color: selected ? '#e07070' : 'var(--text)',
                    border: selected ? '1px solid #e08080' : '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {icon} {key}
                </button>
              );
            })}
          </div>
        </div>

        {/* 음악 취향 */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            좋아하는 음악 장르 <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>(선택 사항)</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MUSIC_GENRES.map((g) => {
              const selected = musicGenres.has(g);
              return (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13,
                    background: selected ? '#7090c0' : 'var(--bg)',
                    color: selected ? 'white' : 'var(--text)',
                    border: selected ? '1px solid #7090c0' : '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: '14px 0', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 15, borderRadius: 12 }}
        >
          {saving ? '저장 중...' : likes.size === 0 && musicGenres.size === 0 ? '건너뛰기' : '저장하고 시작하기'}
        </button>
      </div>
    </div>
  );
}
