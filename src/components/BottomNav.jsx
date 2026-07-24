import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Home, LayoutDashboard, MessageCircle, Trophy, User } from 'lucide-react';

export default function BottomNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  // Müəllim üçün AInur tabı Dashboard ilə əvəzlənir: müəllimin əsas işi
  // şagirdləri izləməkdir, AI məşqi yox. `role` LIVE_USER_FIELDS-dədir,
  // ona görə rol dəyişəndə nav reload olmadan yenilənir.
  const isTeacher = user?.role === 'teacher';
  const tabs = [
    { icon: Home,          label: 'Lobby',   route: '/' },
    { icon: MessageCircle, label: 'Chats',   route: '/chats' },
    isTeacher
      ? { icon: LayoutDashboard, label: 'Dashboard', route: '/teacher' }
      : { icon: Bot,             label: 'AI',        route: '/ai-chat', tourId: 'tour-ai-chat' },
    { icon: Trophy,        label: 'Ranking', route: '/ranking' },
    { icon: User,          label: 'Profile', route: '/profile' },
  ];

  return (
    <div className="bottom-nav" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = path === tab.route;
        return (
          <button
            key={tab.route}
            id={tab.tourId}
            className={`bottom-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.route)}
          >
            <Icon
              size={22}
              color={isActive ? 'var(--accent)' : 'var(--text-muted)'}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
