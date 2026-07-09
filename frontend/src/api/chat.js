import api from './axios';

export const getChatHistory = async (diaryId = null) => {

  const params = diaryId != null ? { diary_id: diaryId } : {};
  const response = await api.get('/api/chat/history', { params });
  return response.data;
};

export const clearChatHistory = async (diaryId = null) => {

  const params = diaryId != null ? { diary_id: diaryId } : {};
  await api.delete('/api/chat/history', { params });
};
