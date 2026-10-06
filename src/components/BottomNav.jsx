import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Home, LayoutDashboard, MessageCircle, FlaskConical, CalendarDays } from 'lucide-react';
import { subscribeToUnreadTotal } from '../utils/chat';
import { subscribeToMyOffers } from '../utils/matchOffers';
import { openOffers } from '../utils/planState';

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
  // Proposals waiting for this learner's yes. The Live tab and its "people
  // searching right now" badge are gone: practice is planned now, and the
  // most time-critical thing the app has to say is "a practice needs your
  // answer", visible from every screen.
  const [offers, setOffers] = useState([]);
  useEffect(() => subscribeToMyOffers(user?.uid, setOffers), [user?.uid]);
  const toAnswer = openOffers(offers, user?.uid).length;
  // Today (what now) · Plan (the week) · Partners (the people you talk to,
  // chats included) · Lab (am I getting better) · AInur. Profile is the avatar
  // at the top of Today, as in most tutoring apps: it is visited, not lived
  // in, and its tab slot was worth more to the progress room that nobody found
  // under Profile → My progress. Tabs are one list here, so the order can
  // change cheaply.
  const tabs = [
    { icon: Home,          label: 'Today',    route: '/' },
    { icon: CalendarDays,  label: 'Plan',     route: '/plan', badge: toAnswer, invite: true, tourId: 'tour-plan-tab' },
    { icon: MessageCircle, label: 'Partners', route: '/chats', badge: unread },
    { icon: FlaskConical,  label: 'Lab',      route: '/lab' },
    isTeacher
      ? { icon: LayoutDashboard, label: 'Dashboard', route: '/teacher' }
      // The lighter purple, not the deep one: colour says who you are talking
      // to, and this tab is the AI one. Every other tab leads to people.
      : { icon: Bot, label: 'AInur', route: '/ai-chat', tourId: 'tour-ai-chat', accent: 'var(--ai)', soft: 'var(--ai-soft)' },
  ];

  // Joining is a full-screen layer: the wizard, then the WhatsApp step. The nav
  // peeking out under it offered a way round "write to us first".
  // A conversation takes the whole screen (WhatsApp-style, chat.css).
  if (path === '/onboarding' || path === '/intro' || path.startsWith('/chat/')) return null;

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
            aria-current={isActive ? 'page' : undefined}
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
                <span
                  // Unread messages are red because they are a backlog; a
                  // proposal waiting for your yes is the accent, because it is
                  // an invitation, not a debt.
                  style={{
                    position: 'absolute', top: '-5px', left: '13px',
                    minWidth: '16px', height: '16px', padding: '0 4px',
                    borderRadius: '20px',
                    background: tab.invite ? 'var(--accent)' : 'var(--danger-solid)',
                    color: tab.invite ? 'var(--text-on-accent)' : 'var(--ink-on-danger)',
                    fontSize: '10px', fontWeight: 800, lineHeight: '16px',
                    textAlign: 'center',
                  }}
                >
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
