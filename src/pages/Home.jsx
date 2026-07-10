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
import { getTodayPuzzleIndex } from '../data/puzzleWords';
import { AchievementsPanel } from '../components/BadgeSystem';
import Logo from '../components/Logo';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useSessionQueue } from '../hooks/useSessionQueue';
import FlaskSearchOverlay from '../components/FlaskSearchOverlay';
import { subscribeToSessionConfig, getSessionWindow } from '../utils/sessionSchedule';
import { remainingMinutes } from '../utils/subscription';
import { ADMIN_UID } from '../constants';
import { getPresence, ONLINE_WINDOW_MS } from '../utils/presence';
import GuidedTour from '../components/GuidedTour';
import { Award, Shuffle, X, Globe, Shield, BookOpen } from 'lucide-react';

const HOME_TOUR_STEPS = [
  {
    target: '#tour-find-partner',
    title: 'Random Partner',
    content: 'Danışıq praktikasına tez başlamaq üçün uyğun partnyor axtarışını buradan başladın.',
    disableBeacon: true,
  },
  {
    target: '#tour-daily-topic',
    title: 'Daily Topic',
    content: 'Zəngdən əvvəl günün mövzusu, yeni sözlər və hazır suallarla buradan tanış olun.',
  },
  {
    target: '#tour-filters',
    title: 'Level Filters',
    content: 'Səviyyənizə uyğun insanları tapmaq üçün bu filtrlərdən istifadə edin.',
  },
  {
    target: '#tour-ai-chat',
    title: 'AI Practice',
    content: 'Real insanla danışmağa hazır deyilsinizsə, AInur ilə dərhal səsli praktika edə bilərsiniz.',
  }
];

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

// Self-ticking countdown line. Isolating the 1s interval here means only this
// tiny element re-renders every second — previously the tick lived in Home
// state and re-rendered the entire page (user grid included) once per second.
function SessionCountdown({ targetMs }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, '0');
  const s = Math.max(0, Math.floor((targetMs - now) / 1000));
  return (
    <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
      Başlamasına qalıb: <b>{`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`}</b>
    </p>
  );
}

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const [userBadges, setUserBadges] = useState(user.badges || []);
  const [dailyTopicOpen, setDailyTopicOpen] = useState(false);
  const [sessionConfig, setSessionConfig] = useState(null);
  const [hideTrialBanner, setHideTrialBanner] = useState(() => localStorage.getItem('hideTrialBanner') === 'true');
  const [sub, setSub] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [showTopicIntro, setShowTopicIntro] = useState(false);
  const [todayTopic, setTodayTopic] = useState(null);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [pendingTopicIntro, setPendingTopicIntro] = useState(false);
  const [streakInfo] = useState(() => getStreakInfo(user));
  const navigate = useNavigate();
  const location = useLocation();

  // The daily-question push deep-links to /?daily=1 — open the topic modal
  // and strip the param so refresh/back doesn't reopen it.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('daily')) {
      setDailyTopicOpen(true);
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);


  useEffect(() => {
    const content = getTodayContent();
    setTodayTopic(content);
    
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

  // Live plan + minute balance so the trial banner counts down after calls
  // (the `user` prop is only loaded once at auth time).
  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setSub(snap.data());
    }, () => {});
  }, [user.uid]);

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

  const {
    joined: sessionJoined,
    joinSession,
    leaveSession,
    unmatchedMsg: sessionUnmatchedMsg,
  } = useSessionQueue({ user, onMatched: handleMatched });

  useEffect(() => subscribeToSessionConfig(setSessionConfig), []);

  // Coarse tick for the session window booleans (open/closed, hideRandom).
  // The per-second countdown lives in SessionCountdown, so 5s accuracy is
  // enough here and Home re-renders 5× less while the card is shown.
  useEffect(() => {
    if (!sessionConfig?.enabled) return;
    const id = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, [sessionConfig?.enabled]);



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

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setUserBadges(snap.exists() ? (snap.data().badges || []) : []);
    });
    return unsub;
  }, [user.uid]);



  const browsableUsers = allUsers.filter(u => u.uid !== user.uid && u.id !== user.uid);
  const isPeopleTab = tab === 'online' || tab === 'all';
  const baseList = tab === 'online' ? onlineUsers : browsableUsers;
  const displayUsers = levelFilter === 'All' ? baseList : baseList.filter(u => u.level === levelFilter);

  // While a session is open or the user is queued, the session is the only CTA —
  // the random-partner button is hidden to avoid the "which button?" confusion.
  const sessionWin = sessionConfig?.enabled ? getSessionWindow(sessionConfig, nowTick) : null;
  const sessionWindowOpen = !!sessionWin && nowTick >= sessionWin.startMs && nowTick < sessionWin.endMs;
  const hideRandom = sessionJoined || sessionWindowOpen;

  return (
    <div className="home-page">
      <GuidedTour
        user={user}
        steps={HOME_TOUR_STEPS}
        tourKey="tourDone_home"
        disabled={showTopicIntro || dailyTopicOpen}
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

        {!hideTrialBanner && sub?.subscriptionPlan === 'trial' && !sub?.isPremium && (() => {
          const mins = remainingMinutes(sub);
          const out = mins <= 0;
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
              background: out ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
              border: `1px solid ${out ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
              borderRadius: 14, padding: '12px 14px', position: 'relative'
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{out ? '⏳' : '⚠️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, lineHeight: 1.35, paddingRight: 24 }}>
                  {out
                    ? 'Sınaq vaxtın bitdi — zəng etmək üçün dəqiqə al.'
                    : <>Balansınız: <b style={{ color: out ? '#ef4444' : '#f59e0b' }}>{mins} dəqiqə</b>.</>}
                </div>
              </div>
              <button
                onClick={() => navigate('/upgrade')}
                style={{
                  flexShrink: 0, border: 'none', borderRadius: 10,
                  background: 'linear-gradient(135deg, #7c6ff7, #6355e0)', color: '#fff',
                  padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Dəqiqə al
              </button>
              <button 
                onClick={() => { setHideTrialBanner(true); localStorage.setItem('hideTrialBanner', 'true'); }}
                style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '12px' }}
              >
                <X size={20} />
              </button>
            </div>
          );
        })()}

        <NotificationPrompt user={user} />

        {sessionConfig?.enabled && (() => {
          const win = getSessionWindow(sessionConfig, nowTick);
          const pad = (n) => String(n).padStart(2, '0');
          const startLabel = `${pad(win.hour)}:${pad(win.minute)}`;
          const sessionTitle = win.hour < 18 ? '☀️ Günorta sessiyası' : '🌙 Axşam sessiyası';
          const inWindow = nowTick >= win.startMs && nowTick < win.endMs;

          return (
            <div className="searching-card" style={{ marginBottom: 12, textAlign: 'center' }}>
              <p style={{ color: '#7c6ff7', fontWeight: 700, fontSize: '15px', margin: '0 0 6px' }}>
                {sessionTitle} • {startLabel}
              </p>
              {nowTick < win.startMs && <SessionCountdown targetMs={win.startMs} />}
              {inWindow && !sessionJoined && (
                <>
                  <p style={{ color: '#666', fontSize: '13px', margin: '0 0 10px' }}>
                    Qoşul — eşləşmələr hazırlanır, zənglər avtomatik başlayacaq
                  </p>
                  <button
                    onClick={() => joinSession(win.sessionId)}
                    style={{
                      background: 'linear-gradient(135deg, #7c6ff7, #6355e0)', color: '#fff',
                      border: 'none', borderRadius: '10px', padding: '10px 20px',
                      fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: '100%',
                    }}
                  >
                    Sessiyaya qoşul
                  </button>
                </>
              )}
              {sessionJoined && (
                <>
                  <FlaskSearchOverlay
                    fullscreen={false}
                    title="Eşləşmə hazırlanır…"
                  />
                  <p style={{ color: '#666', fontSize: '13px', margin: '6px 0 10px' }}>
                    Qoşuldun! Zəngin avtomatik başlayacaq.
                  </p>
                  <button
                    onClick={leaveSession}
                    style={{
                      background: 'transparent', color: '#ef4444',
                      border: '1px solid #ef444455', borderRadius: '10px',
                      padding: '8px 16px', fontWeight: 600, fontSize: '13px',
                      cursor: 'pointer', width: '100%',
                    }}
                  >
                    Sessiyadan çıx
                  </button>
                </>
              )}
              {!sessionJoined && nowTick >= win.endMs && (
                <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
                  Sessiya eşləşmələri gedir…
                </p>
              )}
            </div>
          );
        })()}

        {sessionUnmatchedMsg && (
          <div style={{
            background: 'linear-gradient(135deg, #065f46, #047857)',
            border: '1px solid #10b98155',
            borderRadius: '14px',
            padding: '14px 18px',
            marginBottom: '12px',
            textAlign: 'center',
          }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '14px', margin: 0 }}>
              🎁 {sessionUnmatchedMsg}
            </p>
          </div>
        )}

        {hideRandom ? (
          <div style={{
            textAlign: 'center', color: '#7c6ff7', fontSize: '13px', fontWeight: 600,
            background: 'rgba(124,111,247,0.08)', border: '1px solid rgba(124,111,247,0.25)',
            borderRadius: '12px', padding: '12px 14px',
          }}>
            🧪 Sessiya aktivdir — yuxarıdan qoşul
          </div>
        ) : (
          <>
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
          </>
        )}

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

        {/* Row 1: Daily Topic Button */}
        <button
          id="tour-daily-topic"
          onClick={() => setDailyTopicOpen(true)}
          style={{
            width: '100%',
            height: '44px',
            borderRadius: '14px',
            backgroundColor: '#6C3EF4',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '10px',
            marginTop: '16px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <BookOpen size={18} /> Daily Topic
        </button>

        {/* Daily word puzzle entry — done-state comes from the puzzle page's
            own localStorage record so no extra Firestore read is needed. */}
        {(() => {
          let solved = false;
          try {
            const raw = JSON.parse(localStorage.getItem('dailyPuzzle_v1') || 'null');
            solved = !!raw && raw.dayIndex === getTodayPuzzleIndex() && raw.won;
          } catch (e) {}
          return (
            <button
              onClick={() => navigate('/puzzle')}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '14px',
                background: solved
                  ? 'var(--bg-card)'
                  : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: solved ? 'var(--text-secondary)' : '#ffffff',
                border: solved ? '1px solid var(--border)' : 'none',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '10px',
                cursor: 'pointer',
              }}
            >
              🧩 {solved ? 'Tapmaca həll edildi ✓ — Sabah yenisi!' : 'Günün Tapmacası — +2 dəq qazan'}
            </button>
          );
        })()}

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
                    opacity: !user.isPremium && !u.isPremium ? 0.7 : 1,
                  }}>
                    <div className="user-avatar" style={{
                      boxShadow: u.isPremium ? '0 0 12px #f59e0b66' : undefined,
                    }}>
                      {!user.isPremium ? (
                        <div style={{
                          width: '100%', height: '100%', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #2e2e50, #1e1e30)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '20px',
                        }}>🔒</div>
                      ) : (
                        u.photo
                          ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          : u.name?.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="user-info">
                      <h3>{u.name || 'User'}</h3>
                      {!user.isPremium && (
                        <div style={{ fontSize: '11px', color: '#7c6ff7', fontWeight: 700, marginTop: '2px' }}>
                          Pro ilə tam profil
                        </div>
                      )}
                      <span className="user-level">
                        {user.isPremium ? (u.level || 'English Speaker') : '???'}
                      </span>
                      {user.isPremium && u.bio && (
                        <p className="user-bio">
                          {(u.uid || u.id) === '6Djehd9KB8dTZUgVwVJfLoPI5dF3'
                            ? u.bio
                            : u.bio.split(' ').slice(0, 2).join(' ') + (u.bio.split(' ').length > 2 ? '...' : '')}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {user.isPremium ? (
                          <>
                            <span style={{ fontSize: '11px', color: '#888' }}>📞 {u.callCount || 0}</span>
                            <span style={{ fontSize: '11px', color: '#888' }}>🕐 {u.totalMinutes || 0} dəq</span>
                            {u.streak > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>🔥 {u.streak}</span>}
                            {u.ratingCount > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>⭐ {(u.rating / u.ratingCount).toFixed(1)}</span>}
                          </>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#7c6ff7' }}>⭐ Pro al — tam gör</span>
                        )}
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
