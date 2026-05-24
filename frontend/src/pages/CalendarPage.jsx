// ─── 감정 캘린더 페이지 ────────────────────────────────────────────────────────────
// 월별 달력에 일기 작성 여부를 감정 점수 색상으로 표시
// 날짜 클릭 시 해당 일기 미리보기, 월 이동, 이번 달 통계 요약 포함

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDiaries } from '../api/diary';
import { getMonthlyReport } from '../api/report';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../context/ToastContext';
import BottomNav from '../components/BottomNav';

// WMO 날씨 코드 → 이모지 (DiaryPage와 동일)
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

// ── 요일 레이블 배열 ─────────────────────────────────────────────────────────────
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
// 인덱스 0=일요일, 6=토요일. 달력 헤더에 표시

// ── 공통 카드 스타일 ─────────────────────────────────────────────────────────────
const CARD_STYLE = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius)',
  padding: '20px 24px',
  boxShadow: 'var(--shadow)',
  border: '1px solid var(--border)',
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast();

  const todayDate = new Date(); // 오늘 날짜 객체. 현재 월 기본값 및 "오늘" 표시에 사용
  const [year, setYear] = useState(todayDate.getFullYear()); // 현재 보고 있는 연도
  const [month, setMonth] = useState(todayDate.getMonth());  // 현재 보고 있는 월 (0=1월, 11=12월)
  const [diaries, setDiaries] = useState([]);
  const [selectedDiary, setSelectedDiary] = useState(null);

  // 월간 리포트 상태
  const [report, setReport] = useState(null);       // 생성된 리포트 텍스트
  const [reportLoading, setReportLoading] = useState(false);
  // 월 바뀌면 이전 리포트 초기화
  useEffect(() => { setReport(null); }, [year, month]);

  // nav용 오늘 날짜 텍스트
  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const todayStr = `${todayDate.getMonth() + 1}월 ${todayDate.getDate()}일 ${weekdayNames[todayDate.getDay()]}요일`;

  useEffect(() => {
    // 페이지 로드 시 전체 일기 목록 불러오기
    const fetchDiaries = async () => {
      try {
        const data = await getDiaries(); // GET /api/diary/ → 내 전체 일기 반환
        setDiaries(data);
      } catch {
        navigate('/login'); // 인증 실패 시 로그인으로
      }
    };
    fetchDiaries();
  }, []); // 빈 배열: 처음 한 번만 실행

  // ── 감정 점수 → 배경 색상 ────────────────────────────────────────────────────
  const emotionColor = (score) => {
    // 점수가 없으면 null 반환 → 달력 셀에 색상 없음
    if (!score) return null;
    if (score >= 5) return '#6dc09a'; // 5점: 밝은 초록 (매우 긍정)
    if (score >= 4) return '#8dcc9e'; // 4점: 연초록 (긍정)
    if (score >= 3) return '#e0c080'; // 3점: 노랑 (중립)
    if (score >= 2) return '#e8a070'; // 2점: 주황 (부정)
    return '#e08080';                 // 1점: 빨강 (매우 부정)
  };

  // ── 날짜 키 → 일기 빠른 검색 맵 ─────────────────────────────────────────────
  // 매번 filter()로 찾으면 느리므로, 날짜 문자열을 키로 하는 객체를 만들어 O(1) 조회
  // UTC ISO 문자열을 로컬 날짜 "YYYY-MM-DD"로 변환 (한국 자정 근처 작성 일기 날짜 오류 방지)
  const toLocalDateKey = (isoStr) => {
    const d = new Date(isoStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const diaryMap = {};
  diaries.forEach((d) => {
    const dateKey = toLocalDateKey(d.created_at);
    if (!diaryMap[dateKey]) diaryMap[dateKey] = d;
    // 같은 날짜에 일기가 여러 개면 첫 번째 것만 저장
  });

  // ── 이번 달 일기만 필터링 ────────────────────────────────────────────────────
  const monthDiaries = diaries.filter((d) => {
    const date = new Date(d.created_at);
    return date.getFullYear() === year && date.getMonth() === month;
    // 현재 보고 있는 연도/월과 일치하는 일기만 선택
  });

  // ── 이번 달 통계 계산 ────────────────────────────────────────────────────────
  const scoredDiaries = monthDiaries.filter((d) => d.emotion_score);
  // 감정 점수가 있는 일기만. AI 분석 실패한 일기는 score가 null일 수 있음

  const avgScore = scoredDiaries.length > 0
    ? (scoredDiaries.reduce((sum, d) => sum + d.emotion_score, 0) / scoredDiaries.length).toFixed(1)
    : null;
  // reduce: 배열의 모든 점수를 더함. / scoredDiaries.length: 평균 계산
  // toFixed(1): 소수점 1자리. 예: 3.666... → "3.7"

  const allTags = monthDiaries
    .filter((d) => d.emotion_tags)
    .flatMap((d) => d.emotion_tags.split(',').map((t) => t.trim()));
  // flatMap: 각 일기의 태그 문자열을 배열로 바꾼 뒤 하나의 배열로 합침
  // "기쁨,설렘" → ["기쁨", "설렘"]

  const tagCount = {};
  allTags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; });
  // 각 감정 태그가 몇 번 등장했는지 셈. 예: { 기쁨: 3, 슬픔: 1, 설렘: 2 }

  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  // Object.entries: { 기쁨:3, 슬픔:1 } → [["기쁨",3], ["슬픔",1]]
  // sort: 횟수 내림차순. [0]?.[0]: 가장 많이 나온 태그 이름. ?. 는 배열이 비어있어도 에러 안 남

  // ── 날씨-감정 상관관계 계산 ─────────────────────────────────────────────────
  // 날씨 그룹별 평균 감정 점수. 날씨 기록이 있는 일기만 포함
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
    .sort((a, b) => b.avg - a.avg); // 평균 높은 날씨 먼저

  // ── 월간 리포트 생성 ─────────────────────────────────────────────────────────
  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const data = await getMonthlyReport(year, month + 1); // JS month는 0-based이므로 +1
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

  // ── 월 이동 ──────────────────────────────────────────────────────────────────
  const prevMonth = () => {
    setSelectedDiary(null); // 월 이동 시 선택된 일기 초기화
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    // 1월에서 이전 달로 가면 작년 12월로
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelectedDiary(null);
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    // 12월에서 다음 달로 가면 내년 1월로
    else setMonth((m) => m + 1);
  };

  // ── 달력 셀 배열 만들기 ──────────────────────────────────────────────────────
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  // 이번 달 1일이 무슨 요일인지. 0=일요일, 1=월요일, ...
  // 예: 2025년 5월 1일 = 목요일 → 4

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // month + 1의 0번째 날 = 이번 달의 마지막 날. getDate()로 숫자만 추출
  // 예: 5월 → 6월의 0번째 날 = 5월 31일 → 31

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  // 1일 앞쪽의 빈 칸. 예: 목요일 시작이면 일/월/화/수 4칸이 빈 칸

  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // 실제 날짜 숫자 추가

  while (cells.length % 7 !== 0) cells.push(null);
  // 마지막 주를 7의 배수로 맞추기 위해 뒤에 빈 칸 추가

  // 날짜 → "2025-05-21" 형태의 키 문자열 생성
  const getDateKey = (day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // padStart(2, '0'): 한 자리 숫자를 두 자리로. 예: 5 → "05", 21 → "21"

  // 해당 날짜가 오늘인지 확인
  const isToday = (day) =>
    day === todayDate.getDate() &&
    month === todayDate.getMonth() &&
    year === todayDate.getFullYear();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── 상단 네비게이션 ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        padding: '0 24px', height: 56,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <button
          onClick={() => navigate('/diary')}
          style={{ background: 'transparent', color: 'var(--text-muted)', padding: '6px 12px', fontSize: 14 }}
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
          style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 16, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 10 }}
          title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </nav>

      <div className="page-body mobile-pad" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── 월 이동 헤더 ── */}
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

        {/* ── 이번 달 통계 요약 ── */}
        {monthDiaries.length > 0 ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* 일기 수 */}
            <div style={{ ...CARD_STYLE, padding: '12px 20px', flex: 1, minWidth: 100, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>작성한 일기</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif' }}>
                {monthDiaries.length}개
              </p>
            </div>
            {/* 평균 감정 점수 */}
            {avgScore && (
              <div style={{ ...CARD_STYLE, padding: '12px 20px', flex: 1, minWidth: 100, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>평균 감정</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: emotionColor(Math.round(avgScore)) || 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif' }}>
                  {avgScore}점
                </p>
              </div>
            )}
            {/* 이번 달 대표 감정 태그 */}
            {topTag && (
              <div style={{ ...CARD_STYLE, padding: '12px 20px', flex: 1, minWidth: 100, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>대표 감정</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif' }}>
                  {topTag}
                </p>
              </div>
            )}
          </div>
        ) : (
          // 이번 달 일기가 없을 때
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            이번 달은 아직 일기가 없어요. 일기를 써보세요!
          </div>
        )}

        {/* ── 달력 본체 ── */}
        <div style={{ ...CARD_STYLE, marginBottom: 20 }}>
          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 0',
                  color: i === 0 ? '#e08080'           // 일요일: 빨강
                       : i === 6 ? '#7090c0'           // 토요일: 파랑
                       : 'var(--text-muted)',           // 평일: 흐린 색
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {cells.map((day, idx) => {
              // 빈 칸 (이번 달 날짜 없는 자리)
              if (!day) return <div key={idx} style={{ aspectRatio: '1' }} />;

              const dateKey = getDateKey(day);
              const diary = diaryMap[dateKey]; // 해당 날짜에 일기 있으면 diary 객체, 없으면 undefined
              const color = diary ? emotionColor(diary.emotion_score) : null;
              const todayFlag = isToday(day); // 오늘 날짜인지 여부
              const isSelected = selectedDiary?.id === diary?.id && !!diary;
              // 선택된 일기와 동일한 날짜인지. ?. 로 null 체크

              // 일요일(0) or 토요일(6) 여부로 날짜 숫자 색상 결정
              const col = idx % 7;
              const textColor = color
                ? 'rgba(255,255,255,0.95)'  // 감정 색상 배경 위: 흰 글자
                : col === 0 ? '#e08080'      // 일요일: 빨강
                : col === 6 ? '#7090c0'      // 토요일: 파랑
                : 'var(--text)';             // 평일: 기본 텍스트 색

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (!diary) return; // 일기 없는 날은 클릭 무시
                    setSelectedDiary(isSelected ? null : diary);
                    // 이미 선택된 날 다시 클릭하면 프리뷰 닫힘 (토글)
                  }}
                  style={{
                    aspectRatio: '1',     // 정사각형 유지
                    background: color ? `${color}cc` : 'transparent',
                    // cc = 16진수 80%. 색상이 너무 강하지 않게 투명도 적용
                    border: isSelected
                      ? '2px solid var(--primary-dark)'   // 선택된 셀
                      : todayFlag
                      ? '2px solid var(--primary)'        // 오늘
                      : '1px solid var(--border)',         // 일반
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: diary ? 'pointer' : 'default', // 일기 있을 때만 손가락 커서
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
                  {/* 날씨 이모지 — 날씨 기록이 있는 일기에만 표시 */}
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

        {/* ── 감정 추이 차트 (이번 달 일기가 2개 이상일 때 표시) ── */}
        {(() => {
          // 감정 점수 있는 이번 달 일기, 날짜순 정렬
          const chartData = monthDiaries
            .filter((d) => d.emotion_score)
            .map((d) => ({ day: new Date(d.created_at).getDate(), score: d.emotion_score }))
            .sort((a, b) => a.day - b.day);

          if (chartData.length < 2) return null;
          // 점이 2개 미만이면 선 못 그림 → 차트 숨김

          const W = 600; // SVG viewBox 가로
          const H = 90;  // SVG viewBox 세로
          const PL = 28; // padding left (Y축 레이블 공간)
          const PB = 18; // padding bottom (X축 레이블 공간)
          const PT = 8;  // padding top

          // X 좌표: 날짜(1~daysInMonth)를 SVG 너비로 스케일
          const xScale = (day) =>
            PL + ((day - 1) / (daysInMonth - 1)) * (W - PL - 10);
          // Y 좌표: 점수(1~5)를 SVG 높이로 스케일. 위가 높은 점수
          const yScale = (score) =>
            H - PB - ((score - 1) / 4) * (H - PT - PB);

          const pts = chartData.map((d) => ({ ...d, x: xScale(d.day), y: yScale(d.score) }));
          const polylinePoints = pts.map((p) => `${p.x},${p.y}`).join(' ');
          // 선 경로: 모든 점을 이어서 polyline으로 그림
          const areaPath = `M${pts[0].x},${pts[0].y} ${pts.map((p) => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${H - PB} L${pts[0].x},${H - PB} Z`;
          // 영역 채우기: 선 아래를 채우는 path. Z로 닫기

          return (
            <div style={{ ...CARD_STYLE, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 500 }}>
                이번 달 감정 추이
              </p>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
                {/* 그리드 수평선 + Y축 레이블 */}
                {[1, 2, 3, 4, 5].map((score) => (
                  <g key={score}>
                    <line x1={PL} y1={yScale(score)} x2={W - 10} y2={yScale(score)}
                      stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4,4" />
                    <text x={PL - 4} y={yScale(score) + 4} textAnchor="end" fontSize="9" fill="var(--text-muted)">{score}</text>
                  </g>
                ))}
                {/* 영역 채우기 */}
                <path d={areaPath} fill="var(--primary)" fillOpacity="0.12" />
                {/* 선 */}
                <polyline points={polylinePoints} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {/* 점 + X축 날짜 레이블 */}
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

        {/* ── 색상 범례 ── */}
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

        {/* ── 날씨-감정 상관관계 ── */}
        {weatherStats.length > 0 && (
          <div style={{ ...CARD_STYLE, marginBottom: 20 }}>
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

        {/* ── 월간 감정 리포트 ── */}
        {monthDiaries.length > 0 && (
          <div style={{ ...CARD_STYLE, marginBottom: 20 }}>
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
            {/* AI가 생성한 리포트 텍스트 */}
            {report && (
              <p style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text)', whiteSpace: 'pre-wrap', padding: '14px 0 0', borderTop: '1px solid var(--border)' }}>
                {report}
              </p>
            )}
          </div>
        )}

        {/* ── 선택된 일기 프리뷰 ── */}
        {selectedDiary && (
          <div style={{
            ...CARD_STYLE,
            borderLeft: `4px solid ${emotionColor(selectedDiary.emotion_score) || 'var(--primary)'}`,
            // 감정 점수 색상으로 왼쪽 강조 테두리
          }}>
            {/* 상단: 제목 + 감정 점수 뱃지 */}
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

            {/* 감정 태그 */}
            {selectedDiary.emotion_tags && (
              <p style={{ color: 'var(--primary)', fontSize: 13, marginBottom: 12 }}>
                {selectedDiary.emotion_tags}
              </p>
            )}

            {/* 일기 내용 미리보기 (200자 이후 잘림) */}
            <p style={{ lineHeight: 1.9, fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', marginBottom: 16 }}>
              {selectedDiary.content.length > 200
                ? selectedDiary.content.slice(0, 200) + '...'
                : selectedDiary.content}
              {/* 200자 넘으면 잘라서 ... 붙임. 전체 보기는 일기 페이지에서 */}
            </p>

            {/* 하단 버튼 */}
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
