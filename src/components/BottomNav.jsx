import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Trophy, User } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

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

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="bottom-nav" style={{ paddingBottom: isNative ? '16px' : 'env(safe-area-inset-bottom)', height: isNative ? '76px' : '64px' }}>
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