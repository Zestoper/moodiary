// ─── 인증 관련 API 함수 (회원가입 / 로그인 / 내 정보) ────────────────────────────

import api from './axios'; // 기본 설정이 적용된 axios 인스턴스


export const register = async (email, username, password) => {
  // 회원가입 요청. 백엔드 POST /api/auth/register 호출
  // email, username, password를 받아서 JSON으로 전송
  const response = await api.post('/api/auth/register', {
    email,      // { email: email } 과 동일. 키와 변수명이 같으면 축약 가능
    username,
    password,
  });
  return response.data;
  // response.data: 서버가 돌려준 JSON. 예: { id: 1, email: "...", username: "..." }
};


export const login = async (email, password) => {
  // 로그인 요청. 백엔드 POST /api/auth/login 호출
  // 성공 시 서버가 { access_token: "eyJ...", token_type: "bearer" } 반환
  const response = await api.post('/api/auth/login', { email, password });
  return response.data;
  // 반환값 예: { access_token: "eyJhbG...", token_type: "bearer" }
  // 호출한 쪽에서 access_token을 localStorage에 저장해야 함
};


export const getMe = async () => {
  // 현재 로그인된 유저 정보 조회. 백엔드 GET /api/auth/me 호출
  // axios 인터셉터가 헤더에 토큰을 자동으로 붙여줌
  const response = await api.get('/api/auth/me');
  return response.data;
  // 반환값 예: { id: 1, email: "test@gmail.com", username: "홍길동" }
};
