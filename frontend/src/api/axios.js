// ─── axios 기본 설정 파일 ─────────────────────────────────────────────────────────
// 모든 API 요청에 공통으로 적용할 설정을 여기서 정의함
// 각 api 파일에서 fetch 대신 이 instance를 import해서 사용

import axios from 'axios'; // axios: 브라우저에서 HTTP 요청을 보내는 라이브러리. fetch보다 편리함

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  // baseURL: 모든 요청의 앞에 자동으로 붙는 주소
  // .env의 REACT_APP_API_URL을 읽어옴. 없으면 로컬 개발 주소로 폴백
  // instance.get('/api/diary') → 실제 요청: http://localhost:8000/api/diary
});

// ── 요청 인터셉터 ─────────────────────────────────────────────────────────────────
// 인터셉터: 요청이 서버로 가기 전에 가로채서 뭔가 추가하는 것
// 여기서는 모든 요청 헤더에 JWT 토큰을 자동으로 붙여줌
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // localStorage: 브라우저에 데이터를 저장하는 공간. 로그인 시 토큰을 여기 저장해뒀음

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Authorization 헤더에 토큰 추가
    // 백엔드의 get_current_user()가 이 헤더를 읽어서 로그인된 유저를 파악함
    // 템플릿 리터럴(`Bearer ${token}`): "Bearer " + token 문자열을 합치는 방법
  }

  return config;
});

// ── 응답 인터셉터 ─────────────────────────────────────────────────────────────────
// 401 응답 = 토큰 만료 또는 미인증 → 토큰 삭제 후 로그인 페이지로 강제 이동
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/api/auth/login')) {
      // 로그인 요청 자체의 401(비밀번호 틀림)은 제외. 그 외 401은 토큰 문제
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default instance; // 다른 파일에서 import api from './axios' 로 가져다 씀
