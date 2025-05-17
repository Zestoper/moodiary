// ─── AI 채팅 관련 API 함수 (내역 조회 / 메시지 전송) ────────────────────────────

import api from './axios'; // 토큰 자동 첨부되는 axios 인스턴스


export const getChatHistory = async (diaryId = null) => {
  // diaryId: 일기 채팅방 ID. null이면 일반 채팅 내역 조회
  const params = diaryId != null ? { diary_id: diaryId } : {};
  const response = await api.get('/api/chat/history', { params });
  return response.data;
};


export const clearChatHistory = async (diaryId = null) => {
  // diaryId: 있으면 해당 일기 채팅방만 삭제, 없으면 일반 채팅만 삭제
  const params = diaryId != null ? { diary_id: diaryId } : {};
  await api.delete('/api/chat/history', { params });
};


