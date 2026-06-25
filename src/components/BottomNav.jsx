import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Trophy, User, Settings } from 'lucide-react';

export default function BottomNav({ user, onOpenSettings }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { icon: Home, label: 'Lobby', route: '/' },
    { icon: MessageCircle, label: 'Chats', route: '/chats' },
    { icon: Settings, label: 'Ayarlar', action: onOpenSettings },
    { icon: Trophy, label: 'Ranking', route: '/ranking' },
    { icon: User, label: 'Profile', route: '/profile' },
  ];

  return (
    <div className="bottom-nav">
      {tabs.map((tab, idx) => {
        const Icon = tab.icon;
        const isActive = path === tab.route;
        return (
          <button
            key={tab.route || idx}
            className={`bottom-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => tab.action ? tab.action() : navigate(tab.route)}
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