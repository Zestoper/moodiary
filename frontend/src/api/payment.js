import api from './axios';

export const getPackages = async () => {
  const res = await api.get('/api/payment/packages');
  return res.data;
};

export const verifyPayment = async (imp_uid, merchant_uid, package_id) => {
  const res = await api.post('/api/payment/verify', { imp_uid, merchant_uid, package_id });
  return res.data;
};

export const getPaymentHistory = async () => {
  const res = await api.get('/api/payment/history');
  return res.data;
};
