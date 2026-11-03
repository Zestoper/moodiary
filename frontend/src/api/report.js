import api from './axios';

export const getMonthlyReport = async (year, month) => {

  const response = await api.get('/api/report/monthly', { params: { year, month } });
  return response.data;

};

// 감정 결산 카드 — month 없이 부르면 연간
export const getRecap = async (year, month) => {
  const params = month ? { year, month } : { year };
  const response = await api.get('/api/report/recap', { params });
  return response.data;
};
