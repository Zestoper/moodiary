import api from './axios';

export const createConsultation = async (situation, myAction, partnerAction) => {

  const response = await api.post('/api/consult/', {
    situation,
    my_action: myAction,
    partner_action: partnerAction,
  });
  return response.data;

};

export const getConsultations = async () => {

  const response = await api.get('/api/consult/');
  return response.data;

};

export const getConsultation = async (consultId) => {

  const response = await api.get(`/api/consult/${consultId}`);
  return response.data;
};

export const deleteConsultation = async (consultId) => {

  await api.delete(`/api/consult/${consultId}`);
};
