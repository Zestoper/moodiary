import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register } from '../api/auth';
import { Leaf } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// 카카오·구글 버튼 공통 모양 (색만 다르다)
const socialBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: 'none',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: authLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // 소셜 로그인이 실패하면 백엔드가 /login?oauth_error=... 로, 콜백 페이지가 state.error 로 알려준다
  const [error, setError] = useState(
    () => new URLSearchParams(location.search).get('oauth_error') || location.state?.error || ''
  );

  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/`);
        setServerStatus(res.ok ? 'ok' : 'error');
      } catch {
        setServerStatus('error');
      }
    };
    check();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegister) {
      if (!username.trim()) {
        setError('닉네임을 입력해주세요.');
        return;
      }
      if (password.length < 6) {
        setError('비밀번호는 6자 이상 입력해주세요.');
        return;
      }
    }

    try {
      if (isRegister) {
        await register(email, username, password);

        const loginData = await login(email, password);
        authLogin(null, loginData.access_token);
        navigate('/onboarding');
      } else {
        const data = await login(email, password);
        authLogin(null, data.access_token);
        navigate('/diary');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '오류가 발생했습니다.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div className="auth-card" style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: '48px 40px',
        boxShadow: 'var(--shadow)',
      }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 8, color: 'var(--primary)' }}><Leaf size="1em" strokeWidth={1.75} /></div>
          <h1 style={{
            fontFamily: 'Nanum Myeongjo, serif',
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--primary)',
            letterSpacing: '-0.5px',
          }}>Moodiary</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            오늘의 감정을 기록해요
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12,
            color: serverStatus === 'ok' ? '#2e7d32' : serverStatus === 'error' ? '#e07070' : 'var(--text-muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: serverStatus === 'ok' ? '#4caf50' : serverStatus === 'error' ? '#e07070' : 'var(--text-muted)',
              animation: serverStatus === 'checking' ? 'blink 1s step-end infinite' : 'none',
            }} />
            {serverStatus === 'checking' && '서버 연결 중...'}
            {serverStatus === 'ok'       && '서버 연결됨'}
            {serverStatus === 'error'    && '서버 연결 실패'}
          </div>
        </div>

        <div style={{ display: 'flex', marginBottom: 28, background: '#f5ece4', borderRadius: 12, padding: 4 }}>
          {['로그인', '회원가입'].map((label, i) => (
            <button
              key={label}
              onClick={() => setIsRegister(i === 1)}
              style={{
                flex: 1,
                padding: '10px 0',
                background: isRegister === (i === 1) ? 'var(--surface)' : 'transparent',
                color: isRegister === (i === 1) ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isRegister === (i === 1) ? 600 : 400,
                borderRadius: 10,
                boxShadow: isRegister === (i === 1) ? 'var(--shadow)' : 'none',
                fontSize: 14,
              }}
            >{label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
          {isRegister && (
            <input type="text" placeholder="닉네임" value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
          <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)} />

          {error && (
            <p style={{ color: '#e07070', fontSize: 13, textAlign: 'center' }}>{error}</p>
          )}

          <button type="submit" style={{
            marginTop: 8,
            padding: '14px 0',
            background: 'var(--primary)',
            color: 'white',
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 12,
          }}>
            {isRegister ? '가입하기' : '로그인'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ flex: 1, height: 1, background: '#eadfd5' }} />
          또는
          <span style={{ flex: 1, height: 1, background: '#eadfd5' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 카카오 공식 가이드: 노란 배경 + 검은 글자 */}
          <a href={`${API_URL}/api/auth/kakao/login`} style={{ ...socialBtnStyle, background: '#fee500', color: 'rgba(0, 0, 0, 0.85)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.77l-.95 3.48c-.08.3.26.54.52.37l4.16-2.75c.53.07 1.06.11 1.61.11 5.52 0 10-3.58 10-8S17.52 3 12 3z" /></svg>
            카카오로 시작하기
          </a>
          {/* 구글 공식 가이드: 흰 배경 + 회색 테두리 */}
          <a href={`${API_URL}/api/auth/google/login`} style={{ ...socialBtnStyle, background: '#ffffff', color: '#1f1f1f', border: '1px solid #dadce0' }}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
            Google로 시작하기
          </a>
        </div>
      </div>
    </div>
  );
}
