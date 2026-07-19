import React, { useEffect, useState, useCallback } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';

import DailyTopicModal from '../components/DailyTopicModal';
import NotificationPrompt from '../components/NotificationPrompt';
import StreakModal from '../components/StreakModal';
import StreakJourney from '../components/StreakJourney';
import { getStreakInfo } from '../utils/streak';
import TopicDecorations from '../components/TopicDecorations';
import { getTodayContent } from '../data/weeklyContent';
import { subscribeToCycle } from '../utils/cycle';
import { subscribeToBlocked } from '../utils/blocklist';
import AnalysisReadyModal from '../components/AnalysisReadyModal';
import { AchievementsPanel } from '../components/BadgeSystem';
import Logo from '../components/Logo';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { subscribeToSearchingQueue, SEARCH_STALE_MS, lastAliveMs } from '../utils/matchmaking';
import FlaskSearchOverlay from '../components/FlaskSearchOverlay';
import { ADMIN_UID } from '../constants';
import { getPresence, ONLINE_WINDOW_MS } from '../utils/presence';
import GuidedTour from '../components/GuidedTour';
import CourseProgressCard from '../components/CourseProgressCard';
import SessionDayBanner from '../components/SessionDayBanner';
import CourseCompletionCelebration from '../components/CourseCompletionCelebration';
import { Award, Shuffle, X, Globe, Shield, BookOpen } from 'lucide-react';

// Ordered to match the screen top-to-bottom, ending on the bottom nav.
const HOME_TOUR_STEPS = [
  {
    target: '#tour-find-partner',
    title: 'Buradan başla! 🎙️',
    content: 'Bir toxunuşla səviyyənə (A1–C2) uyğun canlı partnyor tapılır və zəng avtomatik başlayır. İngilis dilini praktika etməyin ən sürətli yolu budur.',
    disableBeacon: true,
  },
  {
    target: '#tour-daily-topic',
    title: 'Günün Mövzusu 📅',
    content: 'Zəngdən əvvəl günün mövzusu, yeni sözlər və hazır suallarla buradan tanış ol — zəngdə nədən danışacağını biləcəksən.',
  },
  {
    target: '#tour-filters',
    title: 'Səviyyə Filtrləri',
    content: 'Səviyyənə uyğun insanları tapmaq üçün bu filtrlərdən istifadə et.',
  },
  {
    target: '#tour-ai-chat',
    title: 'AI Praktika 🤖',
    content: 'Real insanla danışmağa hazır deyilsənsə, AInur ilə dərhal səsli praktika edə bilərsən.',
  }
];

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const [userBadges, setUserBadges] = useState(user.badges || []);
  const [dailyTopicOpen, setDailyTopicOpen] = useState(false);
  const [rawSearchers, setRawSearchers] = useState([]);
  // Value unused — bumping it only forces the staleness re-filter below.
  const [, setSearcherTick] = useState(0);
  const [showTopicIntro, setShowTopicIntro] = useState(false);
  const [todayTopic, setTodayTopic] = useState(null);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [pendingTopicIntro, setPendingTopicIntro] = useState(false);
  const [streakInfo] = useState(() => getStreakInfo(user));
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => subscribeToBlocked(user.uid, setBlockedIds), [user.uid]);

  // The daily-question push deep-links to /?daily=1 — open the topic modal
  // and strip the param so refresh/back doesn't reopen it.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('daily')) {
      setDailyTopicOpen(true);
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);


  // todayTopic MUST track the server cycle, not be captured once: on a cold
  // start the appConfig/cycle snapshot hasn't landed yet, so getTodayContent()
  // falls back to the local calendar formula — the intro modal then announces
  // a different topic than the banner/material (which do subscribe and
  // self-correct). Subscribing here keeps every surface on one truth.
  useEffect(() => subscribeToCycle(() => setTodayTopic(getTodayContent())), []);

  useEffect(() => {
    const todayDateStr = new Date().toDateString();

    const topicKey = `lastTopicIntroDate_v2_${user.uid}`;
    const topicDue = localStorage.getItem(topicKey) !== todayDateStr;
    if (topicDue) localStorage.setItem(topicKey, todayDateStr);

    // The daily streak celebration takes the stage first; the topic intro is
    // deferred until it closes so two full-screen modals never stack.
    const streakKey = `streak_modal_shown_${todayDateStr}_${user.uid}`;
    const streakDue = localStorage.getItem(streakKey) !== '1';

    if (streakDue) {
      setStreakModalOpen(true);
      setPendingTopicIntro(topicDue);
      localStorage.setItem(streakKey, '1');
    } else if (topicDue) {
      setShowTopicIntro(true);
    }
  }, [user.uid]);

  const closeStreakModal = () => {
    setStreakModalOpen(false);
    if (pendingTopicIntro) { setShowTopicIntro(true); setPendingTopicIntro(false); }
  };

  const closeJourney = () => {
    setJourneyOpen(false);
    if (pendingTopicIntro) { setShowTopicIntro(true); setPendingTopicIntro(false); }
  };

  const handleMatched = useCallback((partnerUid, callId) => {
    navigate(`/chat/${partnerUid}`, {
      state: { acceptedCall: true, callId, matchedCall: true },
    });
  }, [navigate]);

  const { searching, startSearch, cancelSearch, compensationMsg } = useMatchmaking({
    user,
    levelFilter,
    onMatched: handleMatched,
  });

  // Polled instead of a live listener: with a live query every user's
  // presence heartbeat would be re-streamed to every Home viewer (read
  // amplification). 20s polling makes an exit visible fast (goOffline stamps
  // status:'offline' instantly; the poll is the only remaining latency).
  // The window/heartbeat pair lives in presence.js / App.js.
  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
        const snap = await getDocs(query(
          collection(db, 'users'),
          where('lastSeen', '>', cutoff),
          limit(50)
        ));
        if (cancelled) return;
        const now = Date.now();
        const online = [];
        const all = [];
        snap.docs.forEach(d => {
          const data = d.data();
          const u = { id: d.id, ...data, uid: data.uid || d.id };
          if (u.uid === user.uid || u.id === user.uid) return;
          all.push(u);
          // getPresence respects status:'offline', so a user who just exited
          // drops off the list on the next poll instead of after the window.
          if (getPresence(u, now) !== 'offline' || u.uid === ADMIN_UID) online.push(u);
        });
        // Free people first — someone already in a call cannot talk to you.
        online.sort((a, b) => (getPresence(a, now) === 'busy') - (getPresence(b, now) === 'busy'));
        setOnlineUsers(online);
        setAllUsers(all);
      } catch (e) {
        console.error('[Home] users load failed:', e);
      }
    };

    loadUsers();
    const interval = setInterval(loadUsers, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user.uid]);



  useEffect(() => () => { cancelSearch(); }, [cancelSearch]);

  // Live searchers, so "somebody is waiting right now" is visible in-app and
  // not only via the FCM ping. Reuses the same capped listener the matcher
  // uses; staleness is re-evaluated on a slow tick because a killed app stops
  // pinging without emitting a final snapshot.
  useEffect(() => subscribeToSearchingQueue(setRawSearchers), []);

  useEffect(() => {
    if (rawSearchers.length === 0) return;
    const id = setInterval(() => setSearcherTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [rawSearchers.length]);

  const searcherNow = Date.now();
  const activeSearchers = rawSearchers.filter((t) =>
    t.uid && t.uid !== user.uid && !t.sessionId
    && !blockedIds.has(t.uid)
    && searcherNow - lastAliveMs(t) <= SEARCH_STALE_MS);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setUserBadges(snap.exists() ? (snap.data().badges || []) : []);
    });
    return unsub;
  }, [user.uid]);



  const browsableUsers = allUsers.filter(u => u.uid !== user.uid && u.id !== user.uid);
  const isPeopleTab = tab === 'online' || tab === 'all';
  const baseList = (tab === 'online' ? onlineUsers : browsableUsers)
    .filter(u => !blockedIds.has(u.uid || u.id));
  const displayUsers = levelFilter === 'All' ? baseList : baseList.filter(u => u.level === levelFilter);

  return (
    <div className="home-page">
      <GuidedTour
        user={user}
        steps={HOME_TOUR_STEPS}
        tourKey="tourDone_home"
        disabled={showTopicIntro || dailyTopicOpen || streakModalOpen || journeyOpen}
      />
      {todayTopic && (
        <TopicDecorations 
          topic={todayTopic.topic} 
          intensity={showTopicIntro || dailyTopicOpen ? 'high' : 'low'} 
        />
      )}
      
      {showTopicIntro && todayTopic && (
        <div className="topic-intro-overlay">
          <div className="topic-intro-modal">
            <h3 className="topic-intro-label">🌟 Bugünün Mövzusu</h3>
            <h1 className="topic-intro-title">{todayTopic.topic}</h1>
            <p className="topic-intro-desc">
              Vocabulary, Idioms və suallara baxaraq mövzuya hazırlaşın!
            </p>
            <div className="topic-intro-actions">
              <button 
                className="topic-intro-btn-primary" 
                onClick={() => {
                  setShowTopicIntro(false);
                  setDailyTopicOpen(true);
                }}
              >
                <BookOpen size={18} /> Öyrənməyə Başla
              </button>
              <button 
                className="topic-intro-btn-secondary" 
                onClick={() => setShowTopicIntro(false)}
              >
                Ekrana Keç
              </button>
            </div>
          </div>
        </div>
      )}



      <div className="home-header">
        <div className="home-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <Logo width={120} />
        </div>
        {user.uid === ADMIN_UID && (
          <button onClick={() => navigate('/admin')} style={{
            background: '#2e2e50', color: '#7c6ff7', border: '1px solid #7c6ff755',
            borderRadius: '10px', padding: '6px 12px', fontWeight: 700,
            fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <Shield size={12} /> Admin
          </button>
        )}
      </div>

      <div className="home-body">

        <CourseCompletionCelebration user={user} />

        <SessionDayBanner user={user} onOpenTopic={() => setDailyTopicOpen(true)} />

        <NotificationPrompt user={user} />

        {activeSearchers.length > 0 && !searching && (
          <div style={{
            background: 'rgba(124,111,247,0.10)',
            border: '1px solid rgba(124,111,247,0.4)',
            borderRadius: '14px', padding: '12px 16px', marginBottom: '10px',
            display: 'flex', alignItems: 'center', gap: '12px',
            animation: 'searcherPulse 2s ease-in-out infinite',
          }}>
            <span style={{ fontSize: '22px' }}>🔎</span>
            <p style={{ flex: 1, color: 'var(--text-primary, #fff)', fontSize: '14px', margin: 0, lineHeight: 1.4 }}>
              <b>{activeSearchers[0].name || 'Bir istifadəçi'}</b>
              {activeSearchers.length > 1 ? ` və daha ${activeSearchers.length - 1} nəfər` : ''} indi partnyor axtarır!
            </p>
            <button
              onClick={startSearch}
              style={{
                background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)', color: '#fff',
                border: 'none', borderRadius: '10px', padding: '10px 14px',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Dərhal qoşul
            </button>
            <style>{`
              @keyframes searcherPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(124,111,247,0.35); }
                50% { box-shadow: 0 0 0 6px rgba(124,111,247,0); }
              }
            `}</style>
          </div>
        )}

        <button
          id="tour-find-partner"
          onClick={searching ? cancelSearch : startSearch}
          className={searching ? 'btn-random searching' : 'btn-random'}
          style={{
            background: searching ? 'linear-gradient(135deg, #ef4444, #dc2626)' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}
        >
          {searching
            ? <><X size={20} /> Axtarılır... (ləğv et)</>
            : <><Shuffle size={20} /> Find Random Partner</>
          }
        </button>

        <FlaskSearchOverlay
          visible={searching}
          title="Tərəfdaş axtarılır…"
          subtitle="Laboratoriyada uyğun partnyor hazırlanır — tapılan kimi zəng avtomatik başlayacaq"
          onCancel={cancelSearch}
          cancelLabel="Axtarışı dayandır"
        />

        {compensationMsg && (
          <div style={{
            background: 'linear-gradient(135deg, #065f46, #047857)',
            border: '1px solid #10b98155',
            borderRadius: '14px',
            padding: '14px 18px',
            marginTop: '10px',
            textAlign: 'center',
            animation: 'fadeInUp 0.4s ease',
          }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '15px', margin: 0 }}>
              🎁 {compensationMsg}
            </p>
            <button 
              onClick={() => navigate('/ai-chat')}
              style={{
                marginTop: '10px', background: '#10b981', color: '#fff',
                border: 'none', borderRadius: '8px', padding: '8px 16px',
                fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', fontSize: '14px'
              }}
            >
              🤖 AInur-a Zəng Et 📞
            </button>
          </div>
        )}

        {/* Günün mövzusu girişi yuxarıdakı SessionDayBanner-dədir — burada
            ayrıca "Daily Topic" düyməsi eyni modalı açırdı və təkrar idi. */}

        {/* Course standing lives BELOW the primary action — a status note
            ("müraciət göndərildi", progress) must never push Find Random
            Partner down the screen. */}
        <CourseProgressCard user={user} />

        {/* Course-join CTA — replaces the daily puzzle. Only shown to users not
            already in a cohort flow (trial/free); course + pending/accepted
            users see their standing in CourseProgressCard instead, so a second
            "join" prompt would be noise for them. */}
        {user.mode !== 'course' && !user.cohortStatus && (
          <button
            onClick={() => navigate('/redeem')}
            style={{
              width: '100%',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
              color: '#ffffff',
              border: 'none',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '16px',
              marginBottom: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(124,111,247,0.4)',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '22px', flexShrink: 0 }}>🎓</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '15px', fontWeight: 800 }}>Kursa qoşul</span>
              <span style={{ display: 'block', fontSize: '12px', opacity: 0.9 }}>Kohorta müraciət et, danışığa başla</span>
            </span>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>→</span>
          </button>
        )}

        <style>{`
          .filter-chip-wrapper::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Row 2: Filter Chips */}
        <div 
          id="tour-filters"
          className="filter-chip-wrapper"
          style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            overflowX: 'auto', 
            gap: '8px', 
            paddingBottom: '4px', 
            marginBottom: '10px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <button
            onClick={() => setTab('online')}
            style={{
              flexShrink: 0,
              height: '36px',
              padding: '0 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              border: tab === 'online' ? '1px solid #6C3EF4' : '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              backgroundColor: tab === 'online' ? '#6C3EF4' : 'rgba(255,255,255,0.08)',
              color: tab === 'online' ? '#ffffff' : 'rgba(255,255,255,0.7)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tab === 'online' ? '#fff' : '#22c55e', display: 'inline-block' }} />
            Online ({onlineUsers.length})
          </button>
          <button
            onClick={() => setTab('all')}
            style={{
              flexShrink: 0,
              height: '36px',
              padding: '0 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              border: tab === 'all' ? '1px solid #6C3EF4' : '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              backgroundColor: tab === 'all' ? '#6C3EF4' : 'rgba(255,255,255,0.08)',
              color: tab === 'all' ? '#ffffff' : 'rgba(255,255,255,0.7)',
            }}
          >
            All ({browsableUsers.length})
          </button>
          <button
            onClick={() => setTab('achievements')}
            style={{
              flexShrink: 0,
              height: '36px',
              padding: '0 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              border: tab === 'achievements' ? '1px solid #6C3EF4' : '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              backgroundColor: tab === 'achievements' ? '#6C3EF4' : 'rgba(255,255,255,0.08)',
              color: tab === 'achievements' ? '#ffffff' : 'rgba(255,255,255,0.7)',
            }}
          >
            <Award size={14} />
            Badges
          </button>
        </div>

        {isPeopleTab && (
          <div className="level-filter">
            {LEVELS.map(l => (
              <button key={l} className={`level-btn ${levelFilter === l ? 'active' : ''}`} onClick={() => setLevelFilter(l)}>
                {l === 'All' ? <><Globe size={12} style={{ marginRight: 4 }} />All</> : l.split(' – ')[0]}
              </button>
            ))}
          </div>
        )}

        {tab === 'achievements' && (
          <AchievementsPanel earnedBadges={userBadges} />
        )}

        {isPeopleTab && (
          <>
            {displayUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">😴</div>
                <p>{tab === 'online' ? 'No one online.' : 'No users yet.'}</p>
              </div>
            ) : (
              <div className="users-grid">
                {displayUsers.map(u => (
                  <div key={u.id || u.uid} className="user-card" style={{
                    border: u.isPremium ? '1px solid #f59e0b55' : '1px solid #2e2e50',
                  }}>
                    <div className="user-avatar" style={{
                      boxShadow: u.isPremium ? '0 0 12px #f59e0b66' : undefined,
                    }}>
                      {u.photo
                        ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        : u.name?.charAt(0).toUpperCase()}
                    </div>

                    <div className="user-info">
                      <h3>{u.name || 'User'}</h3>
                      <span className="user-level">
                        {u.level || 'English Speaker'}
                      </span>
                      {u.bio && (
                        <p className="user-bio">
                          {(u.uid || u.id) === '6Djehd9KB8dTZUgVwVJfLoPI5dF3'
                            ? u.bio
                            : u.bio.split(' ').slice(0, 2).join(' ') + (u.bio.split(' ').length > 2 ? '...' : '')}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#888' }}>📞 {u.callCount || 0}</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>🕐 {u.totalMinutes || 0} dəq</span>
                        {u.streak > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>🔥 {u.streak}</span>}
                        {u.ratingCount > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>⭐ {(u.rating / u.ratingCount).toFixed(1)}</span>}
                      </div>
                      {(() => {
                        const presence = getPresence(u);
                        const label = presence === 'busy' ? '📞 Zəngdə'
                          : presence === 'online' ? '🟢 Online' : '⚫ Offline';
                        return <span className={`online-badge ${presence}`}>{label}</span>;
                      })()}
                    </div>

                    <button
                      className="btn-chat"
                      onClick={() => navigate(`/user/${u.uid || u.id}`)}
                    >
                      👀 View Profile
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <DailyTopicModal open={dailyTopicOpen} onClose={() => setDailyTopicOpen(false)} />
      <AnalysisReadyModal
        user={user}
        suppressed={streakModalOpen || showTopicIntro || dailyTopicOpen || journeyOpen || searching}
      />
      <StreakModal
        open={streakModalOpen}
        streakInfo={streakInfo}
        onClose={closeStreakModal}
        onOpenJourney={() => { setStreakModalOpen(false); setJourneyOpen(true); }}
      />
      <StreakJourney open={journeyOpen} streakInfo={streakInfo} onClose={closeJourney} />
    </div>
  );
}
