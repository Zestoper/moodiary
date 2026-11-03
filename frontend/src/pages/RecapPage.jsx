import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react';
import { getRecap } from '../api/report';
import { useToast } from '../context/ToastContext';
import './RecapPage.css';

// 감정마다 카드 색 (감정 분석 태그 10종)
const EMOTION_COLORS = {
  기쁨: ['#ffb347', '#ff7e5f'], 설렘: ['#ff9a9e', '#fad0c4'], 감사: ['#f6d365', '#fda085'],
  평온: ['#84fab0', '#8fd3f4'], 희망: ['#a1c4fd', '#c2e9fb'], 슬픔: ['#89a4c7', '#5b6f95'],
  우울: ['#6a7b9c', '#3f4c6b'], 외로움: ['#a18cd1', '#6f5fa8'], 불안: ['#c3a3d6', '#8e7cc3'], 분노: ['#f5576c', '#c33764'],
};
const DEFAULT_COLORS = ['#d4845a', '#b5633d'];
const WEATHER_PHRASE = { 맑음: '맑은 날', 구름: '흐린 날', 안개: '안개 낀 날', 비: '비 오는 날', 눈: '눈 오는 날', 뇌우: '천둥 치는 날' };
const SCORE_LABEL = { 1: '많이 힘들었어', 2: '조금 힘들었어', 3: '그럭저럭', 4: '꽤 좋았어', 5: '정말 좋았어' };

function periodOf(key) {
  const now = new Date();
  if (key === 'last') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  if (key === 'year') return { year: now.getFullYear() };
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const fmtDate = (s) => { const [, m, d] = s.split('-'); return `${Number(m)}월 ${Number(d)}일`; };

// 점수 흐름 — 라이브러리 없이 SVG 꺾은선
function Trend({ points, isYear }) {
  if (points.length < 2) return <p className="recap-sub">기록이 더 쌓이면 흐름을 보여줄게</p>;
  const W = 280, H = 120, pad = 14;
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const px = (x) => pad + ((x - minX) / Math.max(maxX - minX, 1)) * (W - pad * 2);
  const py = (s) => H - pad - ((s - 1) / 4) * (H - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.score).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="recap-trend" role="img" aria-label="감정 점수 흐름">
      {[1, 3, 5].map((s) => <line key={s} x1={pad} x2={W - pad} y1={py(s)} y2={py(s)} className="recap-grid" />)}
      <path d={d} className="recap-line" />
      {points.map((p) => <circle key={p.x} cx={px(p.x)} cy={py(p.score)} r="3.5" className="recap-dot" />)}
      <text x={pad} y={H - 1} className="recap-axis">{minX}{isYear ? '월' : '일'}</text>
      <text x={W - pad} y={H - 1} textAnchor="end" className="recap-axis">{maxX}{isYear ? '월' : '일'}</text>
    </svg>
  );
}

function buildCards(r, isYear) {
  const top = r.top_emotions?.[0];
  const cards = [];
  cards.push({ key: 'intro', colors: ['#d4845a', '#8e5a3c'], body: (
    <>
      <p className="recap-kicker">MOODIARY RECAP</p>
      <h2 className="recap-big">{r.period}의<br />내 마음</h2>
      <p className="recap-sub">일기 <b>{r.count}</b>편 · <b>{r.days_written}</b>일 동안 기록했어</p>
    </>
  ) });
  if (top) cards.push({ key: 'top', colors: EMOTION_COLORS[top.tag] || DEFAULT_COLORS, body: (
    <>
      <p className="recap-kicker">가장 많이 느낀 감정</p>
      <h2 className="recap-huge">{top.tag}</h2>
      <p className="recap-sub">전체 감정의 <b>{top.percent}%</b></p>
      <div className="recap-bars">
        {r.top_emotions.map((e) => (
          <div key={e.tag} className="recap-bar-row">
            <span>{e.tag}</span>
            <div className="recap-bar"><div style={{ width: `${e.percent}%` }} /></div>
            <span>{e.percent}%</span>
          </div>
        ))}
      </div>
    </>
  ) });
  cards.push({ key: 'trend', colors: ['#667eea', '#764ba2'], body: (
    <>
      <p className="recap-kicker">마음의 흐름</p>
      <h2 className="recap-big">평균 {r.avg_score ?? '-'}점</h2>
      <p className="recap-sub">{SCORE_LABEL[Math.round(r.avg_score || 3)]}</p>
      <Trend points={r.trend || []} isYear={isYear} />
    </>
  ) });
  if (r.best_day) cards.push({ key: 'days', colors: ['#f093fb', '#f5576c'], body: (
    <>
      <p className="recap-kicker">기억에 남는 날</p>
      <div className="recap-day">
        <span className="recap-day-label">가장 빛났던 날 · {fmtDate(r.best_day.date)}</span>
        <b>“{r.best_day.title}”</b>
      </div>
      {r.hardest_day && (
        <div className="recap-day">
          <span className="recap-day-label">가장 힘들었던 날 · {fmtDate(r.hardest_day.date)}</span>
          <b>“{r.hardest_day.title}”</b>
          <span className="recap-sub">그날도 잘 버텨냈어</span>
        </div>
      )}
    </>
  ) });
  if (r.weather?.length || r.best_weekday) cards.push({ key: 'pattern', colors: ['#43cea2', '#185a9d'], body: (
    <>
      <p className="recap-kicker">데이터로 찾은 나의 패턴</p>
      {r.weather?.length > 0 && (
        <>
          <h2 className="recap-big">{WEATHER_PHRASE[r.weather[0].weather] || r.weather[0].weather}에<br />기분이 제일 좋아</h2>
          <div className="recap-pills">
            {r.weather.map((w) => <span key={w.weather}>{w.weather} {w.avg}점 <small>({w.count})</small></span>)}
          </div>
        </>
      )}
      {r.best_weekday && <p className="recap-sub" style={{ marginTop: 16 }}><b>{r.best_weekday}요일</b>에 가장 기분이 좋았어</p>}
    </>
  ) });
  cards.push({ key: 'streak', colors: ['#fc5c7d', '#6a82fb'], body: (
    <>
      <p className="recap-kicker">꾸준함</p>
      <h2 className="recap-huge">{r.longest_streak}일</h2>
      <p className="recap-sub">연속으로 일기를 썼어</p>
    </>
  ) });
  cards.push({ key: 'final', colors: ['#d4845a', '#3d2b1f'], final: true, body: (
    <>
      <p className="recap-kicker">{r.period}을 돌아보며</p>
      <h2 className="recap-quote">{r.ai_line || '기록해준 모든 날이 다 소중했어. 다음 페이지도 같이 써 내려가자.'}</h2>
      <p className="recap-brand">Moodiary</p>
    </>
  ) });
  return cards;
}

export default function RecapPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const periodKey = params.get('period') || 'this';
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const { year, month } = periodOf(periodKey);
    setLoading(true);
    setIdx(0);
    getRecap(year, month)
      .then(setData)
      .catch(() => addToast('결산을 불러오지 못했어', 'error'))
      .finally(() => setLoading(false));
  }, [periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = data && data.count > 0 ? buildCards(data, periodKey === 'year') : [];
  const go = useCallback((delta) => setIdx((i) => Math.min(Math.max(i + delta, 0), cards.length - 1)), [cards.length]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // 지금 카드를 이미지로 — 공유가 되는 기기(모바일)는 공유 창, 아니면 파일로 저장
  const share = async (download) => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const name = `moodiary-recap-${cards[idx].key}.png`;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: 'image/png' });
      if (!download && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${data.period} 감정 결산` });
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
      }
    } catch (e) {
      if (e?.name !== 'AbortError') addToast('이미지를 만들지 못했어', 'error');
    } finally {
      setSharing(false);
    }
  };

  const card = cards[idx];

  return (
    <div className="recap-page">
      <nav className="recap-top">
        <button className="btn-ghost recap-back" onClick={() => navigate(-1)}><ArrowLeft size="1em" /> 돌아가기</button>
        <div className="recap-tabs">
          {[['this', '이번 달'], ['last', '지난 달'], ['year', '올해']].map(([k, label]) => (
            <button key={k} className={periodKey === k ? 'active' : ''} onClick={() => setParams({ period: k })}>{label}</button>
          ))}
        </div>
      </nav>

      {loading && <div className="recap-card recap-skeleton" />}

      {!loading && data && data.count === 0 && (
        <div className="recap-empty">
          <p>{data.period}에는 아직 쓴 일기가 없어</p>
          <button onClick={() => navigate('/diary')}>일기 쓰러 가기</button>
        </div>
      )}

      {!loading && card && (
        <>
          <div className="recap-progress">
            {cards.map((c, i) => <span key={c.key} className={i <= idx ? 'on' : ''} />)}
          </div>
          <div className="recap-stage">
            <div
              ref={cardRef}
              key={card.key}
              className="recap-card"
              style={{ background: `linear-gradient(150deg, ${card.colors[0]}, ${card.colors[1]})` }}
              onClick={(e) => {
                const { left, width } = e.currentTarget.getBoundingClientRect();
                go(e.clientX - left > width / 3 ? 1 : -1);
              }}
            >
              {card.body}
            </div>
          </div>
          <div className="recap-controls">
            <button onClick={() => go(-1)} disabled={idx === 0} aria-label="이전 카드"><ChevronLeft size={20} /></button>
            <button className="recap-share" onClick={() => share(false)} disabled={sharing}><Share2 size={15} /> 공유</button>
            <button className="recap-share ghost" onClick={() => share(true)} disabled={sharing}><Download size={15} /> 저장</button>
            <button onClick={() => go(1)} disabled={idx === cards.length - 1} aria-label="다음 카드"><ChevronRight size={20} /></button>
          </div>
        </>
      )}
    </div>
  );
}
