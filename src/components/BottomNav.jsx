import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function BottomNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { icon: '🏠', label: 'Lobby', route: '/' },
    { icon: '💬', label: 'Chats', route: '/chats' },
    { icon: '🏆', label: 'Ranking', route: '/ranking' },
    { icon: '👤', label: 'Profile', route: '/profile' },
  ];

  return (
    <div className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.route}
          className={`bottom-nav-btn ${path === tab.route ? 'active' : ''}`}
          onClick={() => navigate(tab.route)}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}