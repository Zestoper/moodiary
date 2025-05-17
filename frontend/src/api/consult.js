// ─── 연애 상담 관련 API 함수 (상담 요청 / 목록 / 상세) ───────────────────────────

import api from './axios'; // 토큰 자동 첨부되는 axios 인스턴스


export const createConsultation = async (situation, myAction, partnerAction) => {
  // 연애 상담 요청. 백엔드 POST /api/consult/
  // Groq AI가 잘잘못 판정 + 화해 문자 자동 생성
  const response = await api.post('/api/consult/', {
    situation,
    my_action: myAction,           // 백엔드 필드명(my_action)에 맞춰서 전송
    partner_action: partnerAction, // 백엔드 필드명(partner_action)에 맞춰서 전송
  });
  return response.data;
  // 반환값: { id, situation, verdict:"상대방 잘못", message_script:"자기야...", ... }
};


export const getConsultations = async () => {
  // 내 연애 상담 목록 조회. 백엔드 GET /api/consult/
  const response = await api.get('/api/consult/');
  return response.data;
  // 반환값: 상담 배열. 최신순 정렬
};


export const getConsultation = async (consultId) => {
  // 특정 상담 상세 조회. 백엔드 GET /api/consult/{consult_id}
  const response = await api.get(`/api/consult/${consultId}`);
  return response.data;
};


export const deleteConsultation = async (consultId) => {
  // 상담 기록 삭제. 백엔드 DELETE /api/consult/{consult_id}
  // 반환값 없음 (204 No Content). 성공하면 그냥 완료
  await api.delete(`/api/consult/${consultId}`);
};
