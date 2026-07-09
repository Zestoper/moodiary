import api from './axios';

export const register = async (email, username, password) => {

  const response = await api.post('/api/auth/register', {
    email,
    username,
    password,
  });
  return response.data;

};

export const login = async (email, password) => {

  const response = await api.post('/api/auth/login', { email, password });
  return response.data;

};

export const getMe = async () => {

  const response = await api.get('/api/auth/me');
  return response.data;

};
