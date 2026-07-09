import api from './axios';

export const getDiaries = async () => {

  const response = await api.get('/api/diary/');
  return response.data;

};

export const createDiary = async (title, content, weatherCode = null, temperature = null) => {

  const response = await api.post('/api/diary/', { title, content, weather_code: weatherCode, temperature });
  return response.data;
};

export const getDiary = async (diaryId) => {

  const response = await api.get(`/api/diary/${diaryId}`);

  return response.data;
};

export const updateDiary = async (diaryId, title, content) => {

  const response = await api.put(`/api/diary/${diaryId}`, { title, content });
  return response.data;
};

export const deleteDiary = async (diaryId) => {
  await api.delete(`/api/diary/${diaryId}`);
};

export const getSolution = async (diaryId) => {

  const response = await api.post(`/api/diary/${diaryId}/solution`);
  return response.data;
};
