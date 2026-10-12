import { CalendarDays, HeartHandshake, MessageCircle, NotebookPen, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: '일기',    path: '/diary',    icon: NotebookPen },
  { label: '캘린더',  path: '/calendar', icon: CalendarDays },
  { label: '채팅',    path: '/chat',     icon: MessageCircle },
  { label: '상담',    path: '/consult',  icon: HeartHandshake },
  { label: '프로필',  path: '/profile',  icon: User },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            className={`bottom-nav-item${active ? ' active' : ''}`}
            onClick={() => navigate(path)}
          >
            <span className="bottom-nav-item-icon"><Icon size="1em" strokeWidth={1.75} /></span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
