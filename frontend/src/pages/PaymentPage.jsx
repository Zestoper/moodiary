// ─── 크레딧 충전 페이지 ───────────────────────────────────────────────────────────
// PortOne(아임포트) SDK로 결제 → 서버 검증 → 크레딧 지급
// PortOne 미설정 시 테스트 모드: 결제창 없이 바로 크레딧 지급

import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPackages, verifyPayment, getPaymentHistory } from '../api/payment';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BottomNav from '../components/BottomNav';

const NAV_ITEMS = [
  { label: '일기', path: '/diary' },
  { label: '캘린더', path: '/calendar' },
  { label: '채팅', path: '/chat' },
  { label: '상담', path: '/consult' },
  { label: '프로필', path: '/profile' },
];

// 기능별 무료 횟수 안내 텍스트
const FREE_QUOTA_INFO = [
  { feature: '맞춤 솔루션', limit: '월 3회' },
  { feature: '연애 상담',   limit: '월 5회' },
  { feature: '월간 리포트', limit: '월 1회' },
];

export default function PaymentPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useContext(AuthContext);
  const { addToast } = useToast();

  const [packages, setPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [paying, setPaying] = useState(null); // 현재 결제 중인 package_id
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // PortOne IMP SDK 스크립트 동적 로드
    if (!window.IMP) {
      const script = document.createElement('script');
      script.src = 'https://cdn.iamport.kr/v1/iamport.js';
      document.head.appendChild(script);
    }

    Promise.all([getPackages(), getPaymentHistory()])
      .then(([pkgData, histData]) => {
        setPackages(pkgData.packages || []);
        setHistory(histData.payments || []);
      })
      .catch(() => addToast('데이터를 불러오지 못했어요', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (pkg) => {
    setPaying(pkg.id);
    try {
      // 주문 ID 생성: 서버가 발급하지 않고 클라이언트에서 생성 (UUID 대신 timestamp 기반)
      const merchant_uid = `moodiary_${Date.now()}`;

      // PortOne 키가 없으면 테스트 모드: 실제 결제창 없이 서버에 바로 전달
      const imp_key = process.env.REACT_APP_PORTONE_IMP_KEY;
      if (!imp_key || imp_key === 'your_imp_key_here') {
        // 테스트 모드: imp_uid를 임시 생성해서 서버에 전달 (서버에서 test 상태로 처리)
        const result = await verifyPayment(`test_${Date.now()}`, merchant_uid, pkg.id);
        if (result.success) {
          await refreshUser();
          addToast(`${pkg.credits} 크레딧이 충전됐어요! (테스트 모드)`, 'success');
          const histData = await getPaymentHistory();
          setHistory(histData.payments || []);
        }
        return;
      }

      // PortOne 결제창 호출
      if (!window.IMP) {
        addToast('결제 모듈 로딩 중이에요. 잠시 후 다시 시도해주세요.', 'error');
        return;
      }
      window.IMP.init(imp_key);

      await new Promise((resolve, reject) => {
        window.IMP.request_pay(
          {
            pg: 'html5_inicis', // PG사. PortOne 대시보드에서 설정한 PG사로 변경
            pay_method: 'card',            // 결제 수단
            merchant_uid,                  // 주문 고유 ID
            name: `Moodiary ${pkg.label}`, // 상품명
            amount: pkg.amount,            // 결제 금액 (원)
            buyer_email: user?.email || '',
            buyer_name: user?.username || '',
          },
          async (rsp) => {
            if (rsp.success) {
              try {
                const result = await verifyPayment(rsp.imp_uid, merchant_uid, pkg.id);
                if (result.success) {
                  await refreshUser();
                  addToast(`${pkg.credits} 크레딧이 충전됐어요!`, 'success');
                  const histData = await getPaymentHistory();
                  setHistory(histData.payments || []);
                }
                resolve();
              } catch (e) {
                addToast('결제 검증에 실패했어요. 고객센터에 문의해주세요.', 'error');
                reject(e);
              }
            } else {
              if (rsp.error_msg !== '사용자가 결제를 취소하셨습니다') {
                addToast(rsp.error_msg || '결제에 실패했어요', 'error');
              }
              resolve();
            }
          }
        );
      });
    } catch (e) {
      addToast('결제 중 오류가 발생했어요', 'error');
    } finally {
      setPaying(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* 네비게이션 */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, height: 56,
      }}>
        <button onClick={() => navigate('/diary')}
          style={{ fontFamily: 'Nanum Myeongjo, serif', fontWeight: 700, color: 'var(--primary)', fontSize: 17, marginRight: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Moodiary
        </button>
        <div className="desktop-only" style={{ gap: 4 }}>
          {NAV_ITEMS.map(({ label, path }) => (
            <button key={path} onClick={() => navigate(path)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14, padding: '6px 10px', borderRadius: 8,
              }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
          보유 크레딧: {user?.credits ?? 0}개
        </span>
      </nav>

      <div className="page-body" style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
        <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', color: 'var(--primary)', marginBottom: 6 }}>
          크레딧 충전
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
          크레딧 1개로 AI 기능 1회를 추가로 이용할 수 있어요.
        </p>

        {/* 무료 제공 안내 */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 28,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
            매달 무료로 제공되는 횟수
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {FREE_QUOTA_INFO.map(({ feature, limit }) => (
              <div key={feature} style={{
                background: 'var(--bg)', borderRadius: 8, padding: '8px 14px',
                fontSize: 13, color: 'var(--text-muted)',
              }}>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{feature}</span>
                &nbsp;{limit} 무료
              </div>
            ))}
          </div>
        </div>

        {/* 패키지 카드 */}
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>불러오는 중...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 36 }}>
            {packages.map((pkg) => (
              <div key={pkg.id} style={{
                background: 'var(--surface)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', padding: '24px 16px',
                textAlign: 'center', boxShadow: 'var(--shadow)',
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
                  {pkg.credits}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>크레딧</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
                  {pkg.amount.toLocaleString()}원
                </div>
                <button
                  onClick={() => handlePurchase(pkg)}
                  disabled={paying === pkg.id}
                  style={{
                    width: '100%', padding: '10px 0',
                    background: paying === pkg.id ? 'var(--border)' : 'var(--primary)',
                    color: 'white', border: 'none', borderRadius: 8,
                    fontSize: 14, fontWeight: 600, cursor: paying === pkg.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {paying === pkg.id ? '처리 중...' : '충전하기'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 결제 내역 */}
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>결제 내역</h3>
        {history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>아직 결제 내역이 없어요.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((p) => (
              <div key={p.id} style={{
                background: 'var(--surface)', borderRadius: 10,
                border: '1px solid var(--border)', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: 14 }}>
                    {p.credits}크레딧
                  </span>
                  <span style={{
                    marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: p.status === 'paid' ? '#e8f5e9' : '#fff3e0',
                    color: p.status === 'paid' ? '#2e7d32' : '#e65100',
                  }}>
                    {p.status === 'paid' ? '결제완료' : '테스트'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>{p.amount.toLocaleString()}원</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
