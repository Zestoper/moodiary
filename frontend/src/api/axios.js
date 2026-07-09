import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',

});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;

  }

  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/api/auth/login')) {

      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default instance;
