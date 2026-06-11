// ─── 연애 상담 페이지 ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createConsultation, getConsultations, deleteConsultation } from '../api/consult';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../context/ToastContext';
import { PERSONA_CONFIRM } from '../constants/persona';
import BottomNav from '../components/BottomNav';

export default function ConsultPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast();

  // 오늘 날짜: "5월 21일 수요일" 형태
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const today = `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;

  const [consultations, setConsultations] = useState([]); // 내 상담 목록
  const [situation, setSituation] = useState('');          // 상황 입력값
  const [myAction, setMyAction] = useState('');            // 내 행동 입력값
  const [partnerAction, setPartnerAction] = useState('');  // 상대방 행동 입력값
  const [loading, setLoading] = useState(false);           // AI 판정 중 여부
  const [result, setResult] = useState(null);              // 가장 최근 상담 결과
  const [selected, setSelected] = useState(null);          // 상세 보기 중인 상담. null이면 목록 보임
  const [copied, setCopied] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const persona = localStorage.getItem('ai_persona') || 'friend';
  const confirm = PERSONA_CONFIRM[persona] || PERSONA_CONFIRM.friend;

  useEffect(() => {
    fetchConsultations(); // 페이지 로드 시 이전 상담 목록 불러오기
  }, []);

  const fetchConsultations = async () => {
    try {
      const data = await getConsultations();
      setConsultations(data);
    } catch {
      navigate('/login'); // 인증 실패 시 로그인 페이지로 이동
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // 폼 새로고침 방지
    if (!situation) return; // 상황은 필수

    setLoading(true);
    setResult(null); // 이전 결과 초기화

    try {
      const data = await createConsultation(situation, myAction, partnerAction);
      // 백엔드에서 Groq AI 판정 후 결과 반환

      setResult(data);
      // 결과창에 판정 + 화해 문자 표시

      setConsultations([data, ...consultations]);
      // 새 상담을 목록 맨 앞에 추가

      setSituation('');    // 입력 폼 초기화
      setMyAction('');
      setPartnerAction('');
    } catch (e) {
      if (e?.response?.status === 402) {
        addToast('이번 달 무료 횟수를 모두 사용했어요. 크레딧을 충전해주세요.', 'error');
        navigate('/payment');
      } else {
        addToast('상담 요청에 실패했어요', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (consultId) => {
    try {
      await deleteConsultation(consultId);
      setConsultations(consultations.filter((c) => c.id !== consultId));
      if (selected?.id === consultId) setSelected(null);
      setConfirmDeleteId(null);
    } catch {
      addToast('삭제에 실패했어요', 'error');
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    // navigator.clipboard.writeText: 브라우저 클립보드에 텍스트 복사. Ctrl+V로 붙여넣기 가능해짐

    setCopied(true); // "복사됨!" 표시
    setTimeout(() => setCopied(false), 2000);
    // 2초(2000ms) 후에 copied를 다시 false로. 버튼 텍스트가 원래대로 돌아옴
  };

  return (
    // 전체 페이지: 최소 높이 100vh, 아이보리 배경
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── 상단 네비게이션 바 ── */}
      <nav className="nav-top">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => navigate('/diary')}
          className="btn-ghost"
        >
          ← 일기로
        </button>
        <div style={{ flex: 1 }}>
          {/* flex: 1 로 제목 영역이 남은 공간 차지 → 다크모드 버튼이 오른쪽 끝으로 밀림 */}
          <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, color: 'var(--primary)' }}>
            💌 연애 상담
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{today}</p>
          {/* 오늘 날짜 표시. 예: "5월 21일 수요일" */}
        </div>
        {/* 다크모드 토글 버튼 */}
        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </nav>

      {/* ── 본문 영역 ── */}
      <div className="page-body mobile-pad" style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

        {selected ? (
          /* ── 상담 상세 보기 ── */
          // selected가 null이 아닐 때 (목록에서 항목 클릭했을 때) 상세 화면 표시
          <div>
            {/* 목록으로 돌아가는 버튼 */}
            <button
              onClick={() => setSelected(null)} // selected를 null로 → 목록 화면으로 전환
              style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 14, padding: '4px 0', marginBottom: 20 }}
            >
              ← 목록으로
            </button>

            {/* 상세 카드 */}
            <div className="card" style={{ cursor: 'default' }}>
              {/* 날짜 */}
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                {new Date(selected.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>

              {/* 상황 설명 */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>상황</p>
                <p style={{ lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{selected.situation}</p>
                {/* pre-wrap: 사용자가 입력한 줄바꿈 그대로 표시 */}
              </div>

              {/* 내 행동 (있을 때만 표시) */}
              {selected.my_action && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>내 행동</p>
                  <p style={{ lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{selected.my_action}</p>
                </div>
              )}

              {/* 상대방 행동 (있을 때만 표시) */}
              {selected.partner_action && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>상대방 행동</p>
                  <p style={{ lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{selected.partner_action}</p>
                </div>
              )}

              {/* 구분선 */}
              <div className="divider" />

              {/* AI 판정 결과 */}
              {selected.verdict && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>🎯 AI 판정</p>
                  <span style={{
                    display: 'inline-block',
                    background: 'var(--primary-light)',
                    color: 'var(--primary-dark)',
                    padding: '8px 20px',
                    borderRadius: 20,
                    fontWeight: 700,
                    fontSize: 16,
                    maxWidth: '100%',
                    wordBreak: 'keep-all',
                  }}>
                    {selected.verdict}
                  </span>
                </div>
              )}

              {/* 화해 문자 스크립트 */}
              {selected.message_script && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>✉️ 화해 문자 스크립트</p>
                    {/* 복사 버튼: 클릭하면 스크립트를 클립보드에 복사 */}
                    <button
                      onClick={() => handleCopy(selected.message_script)}
                      style={{
                        padding: '4px 14px',
                        background: copied ? '#82c9a0' : 'var(--primary-light)',
                        // copied가 true면 초록색(복사됨), false면 기본 포인트 색상
                        color: copied ? 'white' : 'var(--primary-dark)',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 10,
                        transition: 'all 0.2s ease', // 색상 전환을 부드럽게
                      }}
                    >
                      {copied ? '✓ 복사됨!' : '복사'}
                      {/* copied 상태에 따라 버튼 텍스트 변경 */}
                    </button>
                  </div>
                  <div className="content-block">
                    {selected.message_script}
                  </div>
                </div>
              )}
            </div>

            {/* 삭제 버튼 */}
            {confirmDeleteId === selected.id ? (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{confirm.deleteMsg}</span>
                <button onClick={() => handleDelete(selected.id)} className="btn-danger">{confirm.confirmBtn}</button>
                <button onClick={() => setConfirmDeleteId(null)} className="btn-danger-soft">{confirm.cancelBtn}</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(selected.id)}
                className="btn-danger-soft"
                style={{ marginTop: 16 }}
              >
                이 상담 삭제
              </button>
            )}
          </div>

        ) : (
          /* ── 목록 화면 ── */
          <div>
            {/* ── 상담 입력 폼 ── */}
            <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 28 }}>
              <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, marginBottom: 20, color: 'var(--text)' }}>
                상황을 알려주세요
              </h3>

              {/* 상황 설명 (필수) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                  어떤 상황인가요? <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <textarea
                  placeholder="상황을 자세히 설명해주세요"
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  rows={3}
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* 내 행동 (선택) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                  내가 한 행동 <span style={{ fontWeight: 400 }}>(선택)</span>
                </label>
                <textarea
                  placeholder="내가 어떻게 행동했나요?"
                  value={myAction}
                  onChange={(e) => setMyAction(e.target.value)}
                  rows={2}
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* 상대방 행동 (선택) */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                  상대방이 한 행동 <span style={{ fontWeight: 400 }}>(선택)</span>
                </label>
                <textarea
                  placeholder="상대방은 어떻게 반응했나요?"
                  value={partnerAction}
                  onChange={(e) => setPartnerAction(e.target.value)}
                  rows={2}
                  style={{ marginBottom: 0 }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? '💭 AI가 판단 중...' : '💌 판정받기'}
              </button>
            </form>

            {/* ── AI 판정 결과 (상담 직후에만 표시) ── */}
            {result && (
              <div className="card" style={{ marginBottom: 28, border: '1.5px solid var(--primary-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 22 }}>🎯</span>
                  <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, color: 'var(--primary)' }}>AI 판정 결과</h3>
                </div>

                {/* 판정 뱃지 */}
                <div style={{
                  display: 'inline-block',
                  background: 'var(--primary-light)',
                  color: 'var(--primary-dark)',
                  padding: '8px 20px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 16,
                  marginBottom: 20,
                  maxWidth: '100%',
                  wordBreak: 'keep-all',
                }}>
                  {result.verdict}
                </div>

                {/* 화해 문자 스크립트 + 복사 버튼 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✉️ 화해 문자 스크립트
                    </p>
                    <button
                      onClick={() => handleCopy(result.message_script)}
                      style={{
                        padding: '4px 14px',
                        background: copied ? '#82c9a0' : 'var(--primary-light)',
                        color: copied ? 'white' : 'var(--primary-dark)',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 10,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {copied ? '✓ 복사됨!' : '복사'}
                    </button>
                  </div>
                  <div className="content-block">
                    {result.message_script}
                  </div>
                </div>
              </div>
            )}

            {/* ── 이전 상담 기록 목록 ── */}
            <div>
              <h3 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, marginBottom: 16, color: 'var(--text)' }}>
                이전 상담 기록
              </h3>

              {consultations.length === 0 ? (
                // 상담 기록 없을 때 빈 상태 화면
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💌</div>
                  <p>아직 상담 기록이 없어요</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {consultations.map((c) => (
                    <div
                      key={c.id}
                      className="card"
                      style={{
                        padding: '16px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                      onClick={() => setSelected(c)}
                      // 클릭 시 selected에 이 상담 객체를 저장 → 상세 화면으로 전환
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 24px rgba(180,120,80,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'var(--shadow)';
                      }}
                    >
                      {/* 왼쪽: 상황 요약 + 판정 뱃지 + 날짜 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* minWidth: 0 → flex 자식이 텍스트를 넘치지 않게 줄여줌 */}
                        <p style={{ fontWeight: 600, marginBottom: 6, fontSize: 14, color: 'var(--text)' }}>
                          {c.situation.length > 60 ? c.situation.slice(0, 60) + '...' : c.situation}
                          {/* 60글자 넘으면 잘라서 ... 붙임 */}
                        </p>
                        {c.verdict && (
                          <span className="badge" style={{ marginBottom: 6 }}>
                            {c.verdict}
                          </span>
                        )}
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                          {new Date(c.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </p>
                      </div>

                      {/* 오른쪽: 삭제 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // stopPropagation: 이벤트가 부모(카드)로 전파되는 걸 막음
                          // 없으면 삭제 버튼 클릭 시 카드 onClick(상세 보기)도 같이 실행됨
                          handleDelete(c.id);
                        }}
                        style={{
                          flexShrink: 0,             // flex 컨테이너에서 버튼 크기 줄어들지 않게
                          padding: '6px 12px',
                          background: '#fde8e8',
                          color: '#e07070',
                          fontSize: 12,
                          borderRadius: 10,
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
