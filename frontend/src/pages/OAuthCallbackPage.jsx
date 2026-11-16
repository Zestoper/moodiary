import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMe } from '../api/auth';

// 구글/카카오 로그인 후 백엔드가 /oauth/callback#token=... 으로 보내준다.
// 토큰을 저장하고 내 정보를 받아 로그인 상태로 만든 뒤 일기 화면으로 이동한다.
// (처음 가입한 회원은 #token=...&new=1 로 오고, 온보딩 화면으로 보낸다)
export default function OAuthCallbackPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false); // 개발 모드(StrictMode)에서 effect 가 두 번 도는 것 방지

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    const isNew = params.get('new') === '1';
    // 주소창에서 토큰을 지운다 (뒤로가기·복사로 새지 않게)
    window.history.replaceState(null, '', window.location.pathname);

    if (!token) {
      navigate('/login', { replace: true, state: { error: '로그인 정보를 받지 못했습니다.' } });
      return;
    }

    login(null, token); // 토큰 저장 (이후 요청에 자동으로 붙는다)
    getMe()
      .then((me) => {
        login(me, token);
        navigate(isNew ? '/onboarding' : '/diary', { replace: true });
      })
      .catch(() => {
        logout();
        navigate('/login', { replace: true, state: { error: '로그인에 실패했습니다. 다시 시도해주세요.' } });
      });
  }, [login, logout, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--text-muted)',
      fontSize: 14,
    }}>
      로그인 중이에요…
    </div>
  );
}
