// ─── Toast 알림 시스템 ─────────────────────────────────────────────────────────────
// alert() 대신 화면 우측 상단에 잠깐 떴다 사라지는 예쁜 알림창
// Context 패턴: 어떤 컴포넌트에서도 useToast()로 호출 가능

import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);
// createContext: 전역 상태를 만드는 React API. null은 초기값

export function ToastProvider({ children }) {
  // children: 이 컴포넌트로 감싼 하위 컴포넌트들. App.js 전체가 children이 됨
  const [toasts, setToasts] = useState([]);
  // toasts: 현재 화면에 표시 중인 알림 목록. 예: [{ id:1, message:'저장됨', type:'success' }]

  const addToast = useCallback((message, type = 'info') => {
    // useCallback: 함수를 메모이제이션. 불필요한 재생성 방지
    // type: 'success'(초록), 'error'(빨강), 'info'(기본 테라코타)
    const id = Date.now();
    // Date.now(): 현재 시간(밀리초). 고유 ID로 사용. 같은 시간 중복 거의 없음

    setToasts((prev) => [...prev, { id, message, type }]);
    // 기존 목록에 새 알림 추가. 스프레드로 불변성 유지

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      // 3초 후 해당 id 알림 제거. filter: 해당 id 제외한 나머지만 남김
    }, 3000);
  }, []);
  // 빈 의존성 배열: addToast 함수는 최초 1회만 생성

  return (
    <ToastContext.Provider value={{ addToast }}>
      {/* children: App.js 전체 컴포넌트 트리 */}
      {children}

      {/* ── Toast 렌더링 영역 ── */}
      {/* position: fixed → 스크롤해도 항상 같은 위치에 고정 */}
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,          // 다른 모든 요소 위에 표시
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none', // 알림 위에 마우스가 올라가도 뒤쪽 버튼 클릭 가능
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 500,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              background:
                toast.type === 'success' ? '#82c9a0'
              : toast.type === 'error'   ? '#e08080'
              :                            'var(--primary)',
              color: 'white',
              animation: 'toastSlideIn 0.25s ease',
              maxWidth: 'calc(100vw - 48px)',
              wordBreak: 'keep-all',
              pointerEvents: 'auto',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  // 어느 컴포넌트에서나 import해서 쓸 수 있는 훅
  // 사용 예: const { addToast } = useToast();
  //          addToast('저장됨!', 'success');
  return useContext(ToastContext);
}
