import api from './axios';

export const getMonthlyReport = async (year, month) => {

  const response = await api.get('/api/report/monthly', { params: { year, month } });
  return response.data;

};
