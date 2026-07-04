import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Trophy, User } from 'lucide-react';

export default function BottomNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { icon: Home,          label: 'Lobby',   route: '/' },
    { icon: MessageCircle, label: 'Chats',   route: '/chats' },
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
            className={`bottom-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.route)}
          >
            <Icon
              size={22}
              color={isActive ? '#7c6ff7' : '#555'}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}