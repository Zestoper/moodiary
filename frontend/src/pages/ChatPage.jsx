import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getChatHistory, clearChatHistory } from '../api/chat';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../context/ToastContext';

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const diaryId = searchParams.get('diary_id') ? Number(searchParams.get('diary_id')) : null;

  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const bottomRef = useRef(null);

  const persona = localStorage.getItem('ai_persona') || 'friend';
  const PERSONA_LABELS  = { friend: '🌿 친구', mentor: '📚 선배', counselor: '🧠 상담사', cheerleader: '🎉 응원단', simsimi: '🤪 심심이', realist: '🔥 현실러' };
  const PERSONA_AVATARS = { friend: '🌿', mentor: '📚', counselor: '🧠', cheerleader: '🎉', simsimi: '🤪', realist: '🔥' };

  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const today = `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;

  useEffect(() => { fetchHistory(); }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  }, [messages]);

  const fetchHistory = async () => {
    try {
      const data = await getChatHistory(diaryId);
      setMessages(data);
    } catch { navigate('/login'); }
  };

  const handleClear = async () => {
    try {
      await clearChatHistory(diaryId);
      setMessages([]);
      setConfirmClear(false);
      addToast('대화가 초기화됐어', 'success');
    } catch {
      addToast('삭제 실패', 'error');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const myMessage = input;
    setInput('');
    setLoading(true);

    const tempId = Date.now();
    const tempUserMsg = { id: `temp-u-${tempId}`, role: 'user', content: myMessage };
    const tempAiMsg   = { id: `temp-a-${tempId}`, role: 'assistant', content: '' };

    setMessages((prev) => [...prev, tempUserMsg, tempAiMsg]);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: myMessage, persona, diary_id: diaryId }),
      });

      if (!response.ok) throw new Error('전송 실패');

      const reader = response.body.getReader();

      const decoder = new TextDecoder();

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'chunk') {

              setMessages((prev) => {
                const newMsgs = [...prev];
                const last = newMsgs[newMsgs.length - 1];
                newMsgs[newMsgs.length - 1] = { ...last, content: last.content + data.content };
                return newMsgs;

              });
            } else if (data.type === 'done') {

              setMessages((prev) => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 2] = { ...newMsgs[newMsgs.length - 2], id: data.user_msg_id };
                newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], id: data.ai_msg_id };
                return newMsgs;
              });
            } else if (data.type === 'error') {
              addToast('AI 응답에 실패했어', 'error');
            }
          } catch
        }
      }
    } catch {

      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith('temp-')));
      setInput(myMessage);
      addToast('전송 실패. 다시 시도해봐', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      <nav className="nav-top">
        <button onClick={() => navigate('/diary')} className="btn-ghost">← 일기로</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, color: 'var(--primary)' }}>AI 친구</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{today} · {PERSONA_LABELS[persona]}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {messages.length > 0 && !confirmClear && (
            <button onClick={() => setConfirmClear(true)} className="btn-icon" style={{ fontSize: 12 }}>
              대화 초기화
            </button>
          )}
          {confirmClear && (
            <>
              <button onClick={handleClear} className="btn-danger" style={{ padding: '5px 10px', fontSize: 12 }}>삭제</button>
              <button onClick={() => setConfirmClear(false)} className="btn-icon" style={{ fontSize: 12, padding: '5px 10px' }}>취소</button>
            </>
          )}
          <button onClick={toggleTheme} className="btn-icon">
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', maxWidth: 640, width: '100%', margin: '0 auto' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
            <p>AI 친구에게 오늘 하루를 이야기해봐요</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0, fontSize: 18 }}>
                {PERSONA_AVATARS[persona]}
              </div>
            )}
            <div style={{
              maxWidth: '72%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--surface)',
              color: msg.role === 'user' ? 'white' : 'var(--text)',
              boxShadow: 'var(--shadow)',
              fontSize: 14,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}

              {msg.role === 'assistant' && msg.content === '' && (
                <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--primary)', borderRadius: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '16px 24px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 10 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요 (Enter 전송 / Shift+Enter 줄바꿈)"
            rows={2}
            style={{ flex: 1, resize: 'none', fontSize: 14, padding: '12px 16px' }}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            style={{ padding: '0 22px', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 15, borderRadius: 14, flexShrink: 0 }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
