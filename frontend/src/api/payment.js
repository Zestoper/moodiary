// ─── 크레딧 결제 API ─────────────────────────────────────────────────────────────

import api from './axios';

// 크레딧 패키지 목록 조회
export const getPackages = async () => {
  const res = await api.get('/api/payment/packages');
  return res.data; // { packages: [{id, credits, amount, label}] }
};

// 결제 검증 및 크레딧 지급
// imp_uid: PortOne 결제 고유 ID / merchant_uid: 주문 ID / package_id: 구매 패키지 ID
export const verifyPayment = async (imp_uid, merchant_uid, package_id) => {
  const res = await api.post('/api/payment/verify', { imp_uid, merchant_uid, package_id });
  return res.data; // { success, credits_granted, total_credits, status }
};

// 내 결제 내역 조회
export const getPaymentHistory = async () => {
  const res = await api.get('/api/payment/history');
  return res.data; // { payments: [{id, imp_uid, amount, credits, status, created_at}] }
};
