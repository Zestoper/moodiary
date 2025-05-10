// ─── 다크모드 커스텀 훅 ────────────────────────────────────────────────────────────
// 훅(Hook): 여러 컴포넌트에서 공통으로 쓰는 상태/로직을 함수로 분리한 것
// 이 훅을 import하는 어떤 페이지에서도 다크모드를 똑같이 사용할 수 있음

import { useState, useEffect } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    // useState에 함수를 넣으면 "초기값을 계산하는 함수"로 동작
    // 컴포넌트가 처음 렌더링될 때 딱 한 번만 실행됨
    return localStorage.getItem('theme') === 'dark';
    // localStorage: 브라우저에 데이터를 저장하는 공간. 새로고침해도 유지됨
    // 'theme' 키의 값이 'dark'면 true, 아니면 false
  });

  useEffect(() => {
    // isDark 값이 바뀔 때마다 실행 (의존성 배열: [isDark])
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      // document.documentElement: HTML 최상위 요소 (<html> 태그)
      // <html data-theme="dark"> 로 바뀜 → index.css의 [data-theme="dark"] 규칙 적용
      localStorage.setItem('theme', 'dark'); // 브라우저에 'dark' 저장. 새로고침해도 유지
    } else {
      document.documentElement.removeAttribute('data-theme');
      // data-theme 속성 제거 → 다시 라이트모드 CSS 변수 적용
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]); // isDark가 바뀔 때만 실행

  const toggleTheme = () => setIsDark((prev) => !prev);
  // prev: 이전 isDark 값. !prev: 반전. true ↔ false 토글

  return { isDark, toggleTheme };
  // 이 훅을 사용하는 컴포넌트에서 isDark(현재 테마 여부)와 toggleTheme(전환 함수)를 가져다 씀
}
