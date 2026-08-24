import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Home, LayoutDashboard, MessageCircle, Users, User } from 'lucide-react';
import { subscribeToUnreadTotal } from '../utils/chat';

export default function BottomNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  // Müəllim üçün AInur tabı Dashboard ilə əvəzlənir: müəllimin əsas işi
  // şagirdləri izləməkdir, AI məşqi yox. `role` LIVE_USER_FIELDS-dədir,
  // ona görə rol dəyişəndə nav reload olmadan yenilənir.
  const isTeacher = user?.role === 'teacher';
  // Oxunmamış mesaj nişanı — bildiriş gəlməsə belə (icazə verilməyib, telefon
  // susdurulub) istifadəçi tətbiqi açanda yeni mesajı DƏRHAL görməlidir.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToUnreadTotal(user.uid, setUnread);
  }, [user?.uid]);
  const tabs = [
    { icon: Home,          label: 'Today',   route: '/' },
    { icon: MessageCircle, label: 'Chats',   route: '/chats', badge: unread },
    isTeacher
      ? { icon: LayoutDashboard, label: 'Dashboard', route: '/teacher' }
      // The lighter purple, not the deep one: colour says who you are talking
      // to, and this tab is the AI one. Every other tab leads to people.
      : { icon: Bot, label: 'AInur', route: '/ai-chat', tourId: 'tour-ai-chat', accent: 'var(--ai)', soft: 'var(--ai-soft)' },
    { icon: Users,         label: 'Live',    route: '/live' },
    { icon: User,          label: 'Profile', route: '/profile' },
  ];

  return (
    // No safe-area padding here any more. The bar floats now — .bottom-nav sits
    // at `bottom: calc(14px + safe-area)`, so padding it as well would count the
    // inset twice and leave a dead strip inside the bar.
    <div className="bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = path === tab.route;
        return (
          <button
            key={tab.route}
            id={tab.tourId}
            className={`bottom-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.route)}
            // The pool behind the active icon has to be the tab's own step of
            // the purple, or the AI tab pools in the peer colour under an
            // AInur-coloured icon.
            style={isActive && tab.soft ? { '--nav-pool': tab.soft } : undefined}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon
                size={22}
                color={isActive ? (tab.accent || 'var(--accent)') : 'var(--text-muted)'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              {tab.badge > 0 && (
                <span style={{
                  position: 'absolute', top: '-5px', left: '13px',
                  minWidth: '16px', height: '16px', padding: '0 4px',
                  borderRadius: '20px', background: 'var(--danger-solid)', color: 'var(--ink-on-danger)',
                  fontSize: '10px', fontWeight: 800, lineHeight: '16px',
                  textAlign: 'center',
                }}>
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </span>
            <span className="bottom-nav-label" style={isActive && tab.accent ? { color: tab.accent } : undefined}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
