// ─── 월간 감정 리포트 API ─────────────────────────────────────────────────────────

import api from './axios';

export const getMonthlyReport = async (year, month) => {
  // 해당 월의 일기를 AI가 분석한 서술형 리포트 요청
  // year: 연도(예: 2025), month: 월(1~12)
  const response = await api.get('/api/report/monthly', { params: { year, month } });
  return response.data;
  // 반환값: { report: "이번 달...", diary_count: 8 }
  //         일기 없으면: { report: null, diary_count: 0 }
};
