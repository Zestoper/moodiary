import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register } from '../api/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // 'checking' | 'ok' | 'error'
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
    try {
      if (isRegister) {
        await register(email, username, password);
        // 가입 직후 자동 로그인 + 온보딩으로 이동
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
        {/* 로고 영역 */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
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

        {/* 탭 전환 */}
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

        {/* 폼 */}
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
      </div>
    </div>
  );
}
