// ─── 관리자 페이지 ────────────────────────────────────────────────────────────────
// is_admin=true 유저만 접근 가능. 백엔드에서도 403 처리됨.
// 탭: 대시보드 / 유저 목록 / AI 사용량 / 결제 내역

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminStats, getAdminUsers, getAdminAiUsage, getAdminPayments, grantCredits } from '../api/admin';
import { useToast } from '../context/ToastContext';
import BottomNav from '../components/BottomNav';

const TABS = ['대시보드', '유저 목록', 'AI 사용량', '결제 내역'];

// 통계 카드 1개
function StatCard({ label, value, unit = '' }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '20px 24px', flex: '1 1 160px',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)' }}>
        {value?.toLocaleString() ?? '-'}<span style={{ fontSize: 14, fontWeight: 400 }}>{unit}</span>
      </div>
    </div>
  );
}

// AI 사용량 바
function UsageBar({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: 'var(--text)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{value}회</span>
      </div>
      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [tab, setTab] = useState('대시보드');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [aiUsage, setAiUsage] = useState(null);
  const [payments, setPayments] = useState([]);
  const [grantInputs, setGrantInputs] = useState({}); // { [user_id]: credits 입력값 }
  const [loading, setLoading] = useState(false);

  // 탭 전환 시 데이터 로드
  useEffect(() => {
    setLoading(true);
    const load = async () => {
      try {
        if (tab === '대시보드') {
          const data = await getAdminStats();
          setStats(data);
        } else if (tab === '유저 목록') {
          const data = await getAdminUsers();
          setUsers(data.users || []);
        } else if (tab === 'AI 사용량') {
          const data = await getAdminAiUsage();
          setAiUsage(data);
        } else if (tab === '결제 내역') {
          const data = await getAdminPayments();
          setPayments(data.payments || []);
        }
      } catch (e) {
        if (e?.response?.status === 403) {
          addToast('관리자 권한이 필요해요', 'error');
          navigate('/diary');
        } else {
          addToast('데이터를 불러오지 못했어요', 'error');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tab]);

  const handleGrantCredits = async (userId) => {
    const amount = parseInt(grantInputs[userId] || '0', 10);
    if (!amount || amount <= 0) {
      addToast('지급할 크레딧 수를 입력해주세요', 'error');
      return;
    }
    try {
      const result = await grantCredits(userId, amount);
      addToast(`${result.credits_granted}크레딧 지급 완료 (총 ${result.total_credits}개)`, 'success');
      // 유저 목록 갱신
      const data = await getAdminUsers();
      setUsers(data.users || []);
      setGrantInputs((prev) => ({ ...prev, [userId]: '' }));
    } catch {
      addToast('크레딧 지급에 실패했어요', 'error');
    }
  };

  const maxUsage = aiUsage
    ? Math.max(aiUsage.usage.solution, aiUsage.usage.consult, aiUsage.usage.monthly_report, 1)
    : 1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* 헤더 */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', display: 'flex', alignItems: 'center', height: 56,
      }}>
        <button onClick={() => navigate('/diary')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'Nanum Myeongjo, serif', fontWeight: 700, fontSize: 17, marginRight: 20 }}>
          Moodiary
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>관리자 페이지</span>
      </nav>

      <div className="page-body" style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px' }}>
        {/* 탭 */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 12px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1, whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>불러오는 중...</p>}

        {/* ── 대시보드 탭 ─────────────────────────────────────────────── */}
        {!loading && tab === '대시보드' && stats && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <StatCard label="총 가입자" value={stats.total_users} unit="명" />
            <StatCard label="오늘 신규 가입" value={stats.new_today} unit="명" />
            <StatCard label="총 일기 수" value={stats.total_diaries} unit="개" />
            <StatCard label="총 결제 금액" value={stats.total_revenue} unit="원" />
            <StatCard label="AI 사용 횟수" value={stats.total_ai_uses} unit="회" />
          </div>
        )}

        {/* ── 유저 목록 탭 ────────────────────────────────────────────── */}
        {!loading && tab === '유저 목록' && (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>총 {users.length}명</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {['ID', '이메일', '닉네임', '일기', '크레딧', '관리자', '가입일', '크레딧 지급'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{u.id}</td>
                      <td style={{ padding: '10px 12px' }}>{u.email}</td>
                      <td style={{ padding: '10px 12px' }}>{u.username}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.diary_count}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--primary)', fontWeight: 600 }}>{u.credits}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {u.is_admin ? <span style={{ color: '#e07070', fontWeight: 600 }}>관리자</span> : '-'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number"
                            min={1}
                            placeholder="개수"
                            value={grantInputs[u.id] || ''}
                            onChange={(e) => setGrantInputs((prev) => ({ ...prev, [u.id]: e.target.value }))}
                            style={{
                              width: 56, padding: '4px 8px', fontSize: 13,
                              border: '1px solid var(--border)', borderRadius: 6,
                              background: 'var(--bg)', color: 'var(--text)',
                            }}
                          />
                          <button
                            onClick={() => handleGrantCredits(u.id)}
                            style={{
                              padding: '4px 10px', fontSize: 12, fontWeight: 600,
                              background: 'var(--primary)', color: 'white',
                              border: 'none', borderRadius: 6, cursor: 'pointer',
                            }}
                          >
                            지급
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AI 사용량 탭 ────────────────────────────────────────────── */}
        {!loading && tab === 'AI 사용량' && aiUsage && (
          <div style={{ maxWidth: 480 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              {aiUsage.year}년 {aiUsage.month}월 기준
            </p>
            <UsageBar label="맞춤 솔루션" value={aiUsage.usage.solution} max={maxUsage} />
            <UsageBar label="연애 상담" value={aiUsage.usage.consult} max={maxUsage} />
            <UsageBar label="월간 리포트" value={aiUsage.usage.monthly_report} max={maxUsage} />
            <div style={{
              marginTop: 24, padding: '14px 18px', background: 'var(--surface)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>이번 달 총 AI 사용: </span>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                {aiUsage.usage.solution + aiUsage.usage.consult + aiUsage.usage.monthly_report}회
              </span>
            </div>
          </div>
        )}

        {/* ── 결제 내역 탭 ────────────────────────────────────────────── */}
        {!loading && tab === '결제 내역' && (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>최근 {payments.length}건</p>
            {payments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>결제 내역이 없어요.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {['ID', '이메일', '닉네임', '금액', '크레딧', '상태', '일시'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{p.id}</td>
                        <td style={{ padding: '10px 12px' }}>{p.user_email}</td>
                        <td style={{ padding: '10px 12px' }}>{p.username}</td>
                        <td style={{ padding: '10px 12px' }}>{p.amount?.toLocaleString()}원</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--primary)', fontWeight: 600 }}>+{p.credits}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11,
                            background: p.status === 'paid' ? '#e8f5e9' : '#fff3e0',
                            color: p.status === 'paid' ? '#2e7d32' : '#e65100',
                          }}>
                            {p.status === 'paid' ? '결제완료' : '테스트'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {p.created_at ? new Date(p.created_at).toLocaleString('ko-KR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
