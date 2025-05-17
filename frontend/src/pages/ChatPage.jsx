// ─── AI 채팅 페이지 (스트리밍) ─────────────────────────────────────────────────────
// 스트리밍: AI 응답이 한 번에 나타나지 않고, 타이핑되듯 글자 단위로 출력됨
// SSE(Server-Sent Events)로 백엔드에서 실시간으로 데이터를 받음

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getChatHistory, clearChatHistory } from '../api/chat';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../context/ToastContext'; // 알림 훅

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const diaryId = searchParams.get('diary_id') ? Number(searchParams.get('diary_id')) : null;
  // URL에 ?diary_id=3 이 있으면 일기 채팅방, 없으면 일반 채팅
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast(); // addToast('메시지', 'success'|'error'|'info')
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false); // 전송 중 여부 (스트리밍 포함)
  const [confirmClear, setConfirmClear] = useState(false); // 초기화 확인 인라인 UI
  const bottomRef = useRef(null);

  // DiaryPage에서 선택한 페르소나를 읽어옴 (기본값: friend)
  const persona = localStorage.getItem('ai_persona') || 'friend';
  const PERSONA_LABELS = { friend: '🌿 친구', mentor: '📚 선배', counselor: '🧠 상담사', cheerleader: '🎉 응원단', simsimi: '🤪 심심이', realist: '🔥 현실러' };

  // 오늘 날짜
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const today = `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;

  useEffect(() => { fetchHistory(); }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    // 메시지 추가/변경될 때마다 스크롤을 맨 아래로. 스트리밍 중에도 자동 스크롤
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

  // ── 스트리밍 메시지 전송 ────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const myMessage = input;
    setInput('');
    setLoading(true);

    // ── 1. 화면에 즉시 표시 (낙관적 업데이트) ──────────────────────────────────
    // 백엔드 응답 기다리지 않고 먼저 화면에 추가. 사용자 경험 향상
    const tempId = Date.now();
    const tempUserMsg = { id: `temp-u-${tempId}`, role: 'user', content: myMessage };
    const tempAiMsg   = { id: `temp-a-${tempId}`, role: 'assistant', content: '' };
    // tempAiMsg.content: 처음엔 빈 문자열. 스트리밍 청크가 올 때마다 이어붙임
    setMessages((prev) => [...prev, tempUserMsg, tempAiMsg]);

    try {
      const token = localStorage.getItem('token');
      // axios 인터셉터가 없어서 fetch를 직접 사용. 토큰을 수동으로 헤더에 추가
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: myMessage, persona, diary_id: diaryId }),
      });

      if (!response.ok) throw new Error('전송 실패');

      // ── 2. ReadableStream으로 청크 단위 읽기 ────────────────────────────────
      const reader = response.body.getReader();
      // response.body: 스트리밍 응답 바디. getReader()로 읽기 스트림 열기
      const decoder = new TextDecoder();
      // TextDecoder: Uint8Array(바이트 배열) → 문자열로 변환하는 브라우저 내장 API
      let buffer = '';
      // buffer: 한 번의 read()에서 SSE 이벤트가 잘려서 올 수 있음. 불완전한 줄 임시 보관

      while (true) {
        const { done, value } = await reader.read();
        // done: 스트림이 끝났으면 true. value: Uint8Array 형태의 청크 데이터
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // { stream: true }: 멀티바이트 문자가 청크 경계에서 잘려도 올바르게 처리
        const lines = buffer.split('\n');
        buffer = lines.pop();
        // lines.pop(): 마지막 줄이 불완전할 수 있으므로 buffer에 보관. 다음 청크와 합쳐서 처리

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          // SSE 형식: "data: {...JSON...}". data: 로 시작하는 줄만 처리

          const jsonStr = line.slice(6); // "data: " 이후 JSON 문자열 추출
          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'chunk') {
              // 새 텍스트 청크가 옴 → 마지막 AI 메시지에 이어붙이기
              setMessages((prev) => {
                const newMsgs = [...prev];
                const last = newMsgs[newMsgs.length - 1];
                newMsgs[newMsgs.length - 1] = { ...last, content: last.content + data.content };
                return newMsgs;
                // 스프레드로 새 배열 반환 → React가 변화 감지 → 화면 재렌더링
              });
            } else if (data.type === 'done') {
              // 스트리밍 완료 → 임시 id를 실제 DB id로 교체
              setMessages((prev) => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 2] = { ...newMsgs[newMsgs.length - 2], id: data.user_msg_id };
                newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], id: data.ai_msg_id };
                return newMsgs;
              });
            } else if (data.type === 'error') {
              addToast('AI 응답에 실패했어', 'error');
            }
          } catch { /* JSON 파싱 실패 무시. 불완전한 청크는 buffer에서 처리 */ }
        }
      }
    } catch {
      // 전송 실패 시 낙관적으로 추가한 두 메시지 제거
      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith('temp-')));
      setInput(myMessage); // 입력창 복원
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

      {/* ── 헤더 ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, padding: '0 24px', height: 56, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/diary')} style={{ background: 'transparent', color: 'var(--text-muted)', padding: '6px 12px', fontSize: 14 }}>← 일기로</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Nanum Myeongjo, serif', fontSize: 18, color: 'var(--primary)' }}>AI 친구</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{today} · {PERSONA_LABELS[persona]}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {messages.length > 0 && !confirmClear && (
            <button onClick={() => setConfirmClear(true)} style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 12, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
              대화 초기화
            </button>
          )}
          {confirmClear && (
            // window.confirm 대신 인라인 확인 버튼 — 브라우저 기본 팝업 없이 앱 안에서 처리
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>정말 삭제할까요?</span>
              <button onClick={handleClear} style={{ background: '#e08080', color: 'white', fontSize: 12, padding: '6px 12px', borderRadius: 10 }}>삭제</button>
              <button onClick={() => setConfirmClear(false)} style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 12, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>취소</button>
            </>
          )}
          <button onClick={toggleTheme} style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 16, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      {/* ── 채팅 영역 ── */}
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
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0, fontSize: 18 }}>🌿</div>
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
              {/* 스트리밍 중인 AI 메시지이면서 내용이 비어있을 때 커서 애니메이션 표시 */}
              {msg.role === 'assistant' && msg.content === '' && (
                <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--primary)', borderRadius: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── 입력창 ── */}
      {/* mobile-chat-input: 모바일에서 하단 탭바가 없으므로 별도 padding 불필요 */}
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
