import { useEffect, useState } from 'react';
import './ServerWakeGate.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function ServerWakeGate({ children }) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    async function ping() {
      try {
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${API_BASE}/`, { signal: controller.signal });
        clearTimeout(abortTimer);
        if (res.ok) {
          if (!cancelled) setConnected(true);
          return;
        }
      } catch {
        // 서버가 아직 깨어나는 중 - 잠시 후 재시도
      }
      if (!cancelled) retryTimer = setTimeout(ping, 2000);
    }

    ping();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, []);

  if (connected) return children;

  return (
    <div className="server-wake-gate">
      <div className="server-wake-spinner" />
      <p className="server-wake-title">서버에 연결하는 중입니다...</p>
      <p className="server-wake-subtitle">무료 버전이라 최대 30초 정도 소요될 수 있어요</p>
    </div>
  );
}
