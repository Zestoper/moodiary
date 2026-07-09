import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: '일기',    path: '/diary',    icon: '📔' },
  { label: '캘린더',  path: '/calendar', icon: '📅' },
  { label: '채팅',    path: '/chat',     icon: '💬' },
  { label: '상담',    path: '/consult',  icon: '💌' },
  { label: '프로필',  path: '/profile',  icon: '👤' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ label, path, icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            className={`bottom-nav-item${active ? ' active' : ''}`}
            onClick={() => navigate(path)}
          >
            <span className="bottom-nav-item-icon">{icon}</span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
