import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Home, LayoutDashboard, MessageCircle, Trophy, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { subscribeToUnreadTotal } from '../utils/chat';

export default function BottomNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('nav');
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
    { icon: Home,          label: t('lobby'),   route: '/' },
    { icon: MessageCircle, label: t('chats'),   route: '/chats', badge: unread },
    isTeacher
      ? { icon: LayoutDashboard, label: t('dashboard'), route: '/teacher' }
      : { icon: Bot,             label: t('ai'),        route: '/ai-chat', tourId: 'tour-ai-chat' },
    { icon: Trophy,        label: t('ranking'), route: '/ranking' },
    { icon: User,          label: t('profile'), route: '/profile' },
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
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon
                size={22}
                color={isActive ? 'var(--accent)' : 'var(--text-muted)'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              {tab.badge > 0 && (
                <span style={{
                  position: 'absolute', top: '-5px', left: '13px',
                  minWidth: '16px', height: '16px', padding: '0 4px',
                  borderRadius: '20px', background: '#ef4444', color: '#fff',
                  fontSize: '10px', fontWeight: 800, lineHeight: '16px',
                  textAlign: 'center',
                }}>
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
