import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {

  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {

    const id = Date.now();

    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));

    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>

      {children}

      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
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

  return useContext(ToastContext);
}
