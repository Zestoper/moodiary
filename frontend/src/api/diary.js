// ─── 일기 관련 API 함수 (목록 / 작성 / 상세 / 수정 / 삭제) ──────────────────────

import api from './axios'; // 토큰 자동 첨부되는 axios 인스턴스


export const getDiaries = async () => {
  // 내 일기 목록 조회. 백엔드 GET /api/diary/
  const response = await api.get('/api/diary/');
  return response.data;
  // 반환값: DiaryResponse 객체 배열. 예: [{ id:1, title:"오늘", ... }, ...]
};


export const createDiary = async (title, content, weatherCode = null, temperature = null) => {
  // 일기 작성. weatherCode, temperature: 작성 시 자동 기록된 날씨 정보 (없어도 됨)
  const response = await api.post('/api/diary/', { title, content, weather_code: weatherCode, temperature });
  return response.data;
};


export const getDiary = async (diaryId) => {
  // 특정 일기 상세 조회. 백엔드 GET /api/diary/{diary_id}
  const response = await api.get(`/api/diary/${diaryId}`);
  // 템플릿 리터럴: /api/diary/3 처럼 diaryId를 URL에 동적으로 삽입
  return response.data;
};


export const updateDiary = async (diaryId, title, content) => {
  // 일기 수정. 백엔드 PUT /api/diary/{diary_id}
  // title, content 중 변경하고 싶은 것만 보내도 됨 (나머지는 기존 값 유지)
  const response = await api.put(`/api/diary/${diaryId}`, { title, content });
  return response.data;
};


export const deleteDiary = async (diaryId) => {
  await api.delete(`/api/diary/${diaryId}`);
};


export const getSolution = async (diaryId) => {
  // 맞춤 솔루션 생성/조회. 이미 생성된 경우 캐시된 값 반환
  const response = await api.post(`/api/diary/${diaryId}/solution`);
  return response.data;
};
