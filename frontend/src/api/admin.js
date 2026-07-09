import api from './axios';

export const getAdminStats = async () => {
  const res = await api.get('/api/admin/stats');
  return res.data;
};

export const getAdminUsers = async () => {
  const res = await api.get('/api/admin/users');
  return res.data;
};

export const getAdminAiUsage = async () => {
  const res = await api.get('/api/admin/ai-usage');
  return res.data;
};

export const getAdminPayments = async () => {
  const res = await api.get('/api/admin/payments');
  return res.data;
};

export const grantCredits = async (user_id, credits) => {
  const res = await api.post('/api/admin/credits', { user_id, credits });
  return res.data;
};
