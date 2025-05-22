// ─── 관리자 API ──────────────────────────────────────────────────────────────────

import api from './axios';

// 대시보드 요약 통계
export const getAdminStats = async () => {
  const res = await api.get('/api/admin/stats');
  return res.data; // { total_users, new_today, total_diaries, total_revenue, total_ai_uses }
};

// 유저 목록 (일기 수 포함)
export const getAdminUsers = async () => {
  const res = await api.get('/api/admin/users');
  return res.data; // { users: [{id, email, username, credits, is_admin, diary_count, created_at}] }
};

// 이번 달 기능별 AI 사용량
export const getAdminAiUsage = async () => {
  const res = await api.get('/api/admin/ai-usage');
  return res.data; // { year, month, usage: { solution, consult, monthly_report } }
};

// 최근 결제 내역
export const getAdminPayments = async () => {
  const res = await api.get('/api/admin/payments');
  return res.data; // { payments: [{id, user_email, username, amount, credits, status, created_at}] }
};

// 유저에게 크레딧 수동 지급
export const grantCredits = async (user_id, credits) => {
  const res = await api.post('/api/admin/credits', { user_id, credits });
  return res.data; // { success, user_id, credits_granted, total_credits }
};
