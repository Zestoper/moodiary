import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDiaries } from '../api/diary';
import { getMonthlyReport } from '../api/report';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../context/ToastContext';
import BottomNav from '../components/BottomNav';

const WMO = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌦️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast();

  const todayDate = new Date();
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [diaries, setDiaries] = useState([]);
  const [selectedDiary, setSelectedDiary] = useState(null);

  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => { setReport(null); }, [year, month]);

  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const todayStr = `${todayDate.getMonth() + 1}월 ${todayDate.getDate()}일 ${weekdayNames[todayDate.getDay()]}요일`;

  useEffect(() => {

    const fetchDiaries = async () => {
      try {
        const data = await getDiaries();
        setDiaries(data);
      } catch {
        navigate('/login');
      }
    };
    fetchDiaries();
  }, []);

  const emotionColor = (score) => {

    if (!score) return null;
    if (score >= 5) return '#6dc09a';
    if (score >= 4) return '#8dcc9e';
    if (score >= 3) return '#e0c080';
    if (score >= 2) return '#e8a070';
    return '#e08080';
  };

  const toLocalDateKey = (isoStr) => {
    const d = new Date(isoStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const diaryMap = {};
  diaries.forEach((d) => {
    const dateKey = toLocalDateKey(d.created_at);
    if (!diaryMap[dateKey]) diaryMap[dateKey] = d;

  });

  const monthDiaries = diaries.filter((d) => {
    const date = new Date(d.created_at);
    return date.getFullYear() === year && date.getMonth() === month;

  });

  const scoredDiaries = monthDiaries.filter((d) => d.emotion_score);

  const avgScore = scoredDiaries.length > 0
    ? (scoredDiaries.reduce((sum, d) => sum + d.emotion_score, 0) / scoredDiaries.length).toFixed(1)
    : null;

  const allTags = monthDiaries
    .filter((d) => d.emotion_tags)
    .flatMap((d) => d.emotion_tags.split(',').map((t) => t.trim()));

  const tagCount = {};
  allTags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; });

  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0]?.[0];

  const weatherGroups = {};
  monthDiaries.forEach((d) => {
    if (d.weather_code == null || !d.emotion_score) return;
    const emoji = WMO[d.weather_code] || '🌡️';
    if (!weatherGroups[emoji]) weatherGroups[emoji] = [];
    weatherGroups[emoji].push(d.emotion_score);
  });
  const weatherStats = Object.entries(weatherGroups)
    .map(([emoji, scores]) => ({
      emoji,
      avg: (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1),
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const data = await getMonthlyReport(year, month + 1);
      setReport(data.report);
      if (!data.report) addToast('이번 달 일기가 없어요', 'info');
    } catch (e) {
      if (e?.response?.status === 402) {
        addToast('이번 달 무료 횟수를 모두 사용했어요. 크레딧을 충전해주세요.', 'error');
        navigate('/payment');
      } else {
        addToast('리포트 생성에 실패했어요', 'error');
      }
    } finally {
      setReportLoading(false);
    }
  };

  const prevMonth = () => {
    setSelectedDiary(null);
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }

    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelectedDiary(null);
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }

    else setMonth((m) => m + 1);
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);

  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  while (cells.length % 7 !== 0) cells.push(null);

  const getDateKey = (day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isToday = (day) =>
    day === todayDate.getDate() &&
    month === todayDate.getMonth() &&
    year === todayDate.getFullYear();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      <nav className="nav-top">
        <button
          onClick={() => navigate('/diary')}
          className="btn-ghost"
        >
          ← 일기로
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, color: 'var(--primary)' }}>
            감정 캘린더
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{todayStr}</p>
        </div>
        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </nav>

      <div className="page-body mobile-pad" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            onClick={prevMonth}
            style={{ background: 'var(--surface)', color: 'var(--text)', padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 16 }}
          >
            ←
          </button>
          <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 22, color: 'var(--text)' }}>
            {year}년 {month + 1}월
          </h2>
          <button
            onClick={nextMonth}
            style={{ background: 'var(--surface)', color: 'var(--text)', padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 16 }}
          >
            →
          </button>
        </div>

        {monthDiaries.length > 0 ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>

            <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 100, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>작성한 일기</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif' }}>
                {monthDiaries.length}개
              </p>
            </div>

            {avgScore && (
              <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 100, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>평균 감정</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: emotionColor(Math.round(avgScore)) || 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif' }}>
                  {avgScore}점
                </p>
              </div>
            )}

            {topTag && (
              <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 100, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>대표 감정</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif' }}>
                  {topTag}
                </p>
              </div>
            )}
          </div>
        ) : (

          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            이번 달은 아직 일기가 없어요. 일기를 써보세요!
          </div>
        )}

        <div className="mcard card" style={{ marginBottom: 20 }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 0',
                  color: i === 0 ? '#e08080'
                       : i === 6 ? '#7090c0'
                       : 'var(--text-muted)',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cells.map((day, idx) => {

              if (!day) return <div key={idx} style={{ aspectRatio: '1' }} />;

              const dateKey = getDateKey(day);
              const diary = diaryMap[dateKey];
              const color = diary ? emotionColor(diary.emotion_score) : null;
              const todayFlag = isToday(day);
              const isSelected = selectedDiary?.id === diary?.id && !!diary;

              const col = idx % 7;
              const textColor = color
                ? 'rgba(255,255,255,0.95)'
                : col === 0 ? '#e08080'
                : col === 6 ? '#7090c0'
                : 'var(--text)';

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (!diary) return;
                    setSelectedDiary(isSelected ? null : diary);

                  }}
                  style={{
                    aspectRatio: '1',
                    background: color ? `${color}cc` : 'transparent',

                    border: isSelected
                      ? '2px solid var(--primary-dark)'
                      : todayFlag
                      ? '2px solid var(--primary)'
                      : '1px solid var(--border)',
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: diary ? 'pointer' : 'default',
                    transition: 'transform 0.1s ease',
                  }}
                  onMouseEnter={(e) => { if (diary) e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                >
                  <span style={{ fontSize: 13, fontWeight: todayFlag ? 700 : 400, color: textColor }}>
                    {day}
                  </span>
                  {diary?.emotion_score && (
                    <span style={{ fontSize: 9, color: color ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', marginTop: 1 }}>
                      {diary.emotion_score}점
                    </span>
                  )}

                  {diary?.weather_code != null && (
                    <span style={{ fontSize: 9, lineHeight: 1, marginTop: 1 }}>
                      {WMO[diary.weather_code] || '🌡️'}
                    </span>
                  )}
                  {diary && !diary.emotion_score && diary.weather_code == null && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)', marginTop: 2 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {(() => {

          const chartData = monthDiaries
            .filter((d) => d.emotion_score)
            .map((d) => ({ day: new Date(d.created_at).getDate(), score: d.emotion_score }))
            .sort((a, b) => a.day - b.day);

          if (chartData.length < 2) return null;

          const W = 600;
          const H = 90;
          const PL = 28;
          const PB = 18;
          const PT = 8;

          const xScale = (day) =>
            PL + ((day - 1) / (daysInMonth - 1)) * (W - PL - 10);

          const yScale = (score) =>
            H - PB - ((score - 1) / 4) * (H - PT - PB);

          const pts = chartData.map((d) => ({ ...d, x: xScale(d.day), y: yScale(d.score) }));
          const polylinePoints = pts.map((p) => `${p.x},${p.y}`).join(' ');

          const areaPath = `M${pts[0].x},${pts[0].y} ${pts.map((p) => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${H - PB} L${pts[0].x},${H - PB} Z`;

          return (
            <div className="card" style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 500 }}>
                이번 달 감정 추이
              </p>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>

                {[1, 2, 3, 4, 5].map((score) => (
                  <g key={score}>
                    <line x1={PL} y1={yScale(score)} x2={W - 10} y2={yScale(score)}
                      stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4,4" />
                    <text x={PL - 4} y={yScale(score) + 4} textAnchor="end" fontSize="9" fill="var(--text-muted)">{score}</text>
                  </g>
                ))}

                <path d={areaPath} fill="var(--primary)" fillOpacity="0.12" />

                <polyline points={polylinePoints} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                {pts.map((p) => (
                  <g key={p.day}>
                    <circle cx={p.x} cy={p.y} r="4" fill={emotionColor(p.score)} stroke="var(--surface)" strokeWidth="1.5" />
                    <text x={p.x} y={H - 2} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{p.day}일</text>
                  </g>
                ))}
              </svg>
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { color: '#6dc09a', label: '5점 · 매우 좋음' },
            { color: '#8dcc9e', label: '4점 · 좋음' },
            { color: '#e0c080', label: '3점 · 보통' },
            { color: '#e8a070', label: '2점 · 나쁨' },
            { color: '#e08080', label: '1점 · 매우 나쁨' },
          ].map((item) => (
            <div
              key={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 4, background: item.color, flexShrink: 0 }} />
              {item.label}
            </div>
          ))}
        </div>

        {weatherStats.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
              날씨별 평균 감정
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {weatherStats.map(({ emoji, avg, count }) => (
                <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg)', borderRadius: 20, fontSize: 13 }}>
                  <span style={{ fontSize: 18 }}>{emoji}</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{avg}점</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({count}일)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {monthDiaries.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: report ? 14 : 0 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                {year}년 {month + 1}월 감정 리포트
              </p>
              {!report && (
                <button
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                  style={{ padding: '7px 16px', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, borderRadius: 10 }}
                >
                  {reportLoading ? '분석 중...' : '리포트 생성'}
                </button>
              )}
              {report && (
                <button
                  onClick={() => setReport(null)}
                  style={{ padding: '4px 10px', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8 }}
                >
                  닫기
                </button>
              )}
            </div>

            {report && (
              <p style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text)', whiteSpace: 'pre-wrap', padding: '14px 0 0', borderTop: '1px solid var(--border)' }}>
                {report}
              </p>
            )}
          </div>
        )}

        {selectedDiary && (
          <div
            className="card"
            style={{ borderLeft: `4px solid ${emotionColor(selectedDiary.emotion_score) || 'var(--primary)'}` }}
          >

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, marginBottom: 4 }}>
                  {selectedDiary.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {new Date(selectedDiary.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </p>
              </div>
              {selectedDiary.emotion_score && (
                <span style={{
                  background: emotionColor(selectedDiary.emotion_score),
                  color: 'white',
                  padding: '3px 12px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {selectedDiary.emotion_score}점
                </span>
              )}
            </div>

            {selectedDiary.emotion_tags && (
              <p style={{ color: 'var(--primary)', fontSize: 13, marginBottom: 12 }}>
                {selectedDiary.emotion_tags}
              </p>
            )}

            <p style={{ lineHeight: 1.9, fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', marginBottom: 16 }}>
              {selectedDiary.content.length > 200
                ? selectedDiary.content.slice(0, 200) + '...'
                : selectedDiary.content}

            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/diary', { state: { openId: selectedDiary.id } })}
                style={{ flex: 1, padding: '10px 0', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, borderRadius: 10 }}
              >
                일기 페이지에서 전체 보기
              </button>
              <button
                onClick={() => navigate('/chat')}
                style={{ padding: '10px 16px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 600, fontSize: 13, borderRadius: 10 }}
              >
                AI와 대화
              </button>
            </div>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
