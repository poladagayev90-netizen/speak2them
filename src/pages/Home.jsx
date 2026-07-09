import React, { useEffect, useState, useCallback } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

import DailyTopicModal from '../components/DailyTopicModal';
import NotificationPrompt from '../components/NotificationPrompt';
import TopicDecorations from '../components/TopicDecorations';
import { getTodayContent } from '../data/weeklyContent';
import { AchievementsPanel } from '../components/BadgeSystem';
import Logo from '../components/Logo';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useSessionQueue } from '../hooks/useSessionQueue';
import FlaskSearchOverlay from '../components/FlaskSearchOverlay';
import { subscribeToSessionConfig, getSessionWindow } from '../utils/sessionSchedule';
import { ADMIN_UID } from '../constants';
import { getPresence } from '../utils/presence';
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

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const [userBadges, setUserBadges] = useState(user.badges || []);
  const [dailyTopicOpen, setDailyTopicOpen] = useState(false);
  const [sessionConfig, setSessionConfig] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [showTopicIntro, setShowTopicIntro] = useState(false);
  const [todayTopic, setTodayTopic] = useState(null);
  const navigate = useNavigate();


  useEffect(() => {
    const content = getTodayContent();
    setTodayTopic(content);
    
    const todayDateStr = new Date().toDateString();
    const storageKey = `lastTopicIntroDate_v2_${user.uid}`;
    const lastSeenDate = localStorage.getItem(storageKey);
    
    // Check if the current user has seen the topic intro today
    if (lastSeenDate !== todayDateStr) {
      setShowTopicIntro(true);
      localStorage.setItem(storageKey, todayDateStr);
    }
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

  // 1s tick drives the session countdown; runs only while the card is shown.
  useEffect(() => {
    if (!sessionConfig?.enabled) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionConfig?.enabled]);



  // Polled instead of a live listener: with a live query every user's
  // presence heartbeat would be re-streamed to every Home viewer (read
  // amplification). 60s polling is fresh enough for an online list.
  // Online window is 300s to stay coherent with the 120s heartbeat.
  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const cutoff = new Date(Date.now() - 300000);
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
          if (!u.lastSeen) return;
          const lastSeen = u.lastSeen.toMillis?.() || 0;
          if (now - lastSeen < 300000 || u.uid === ADMIN_UID) online.push(u);
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
    const interval = setInterval(loadUsers, 60000);
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

        <NotificationPrompt user={user} />

        {sessionConfig?.enabled && (() => {
          const win = getSessionWindow(sessionConfig, nowTick);
          const pad = (n) => String(n).padStart(2, '0');
          const startLabel = `${pad(win.hour)}:${pad(win.minute)}`;
          const sessionTitle = win.hour < 18 ? '☀️ Günorta sessiyası' : '🌙 Axşam sessiyası';
          const fmtLeft = (ms) => {
            const s = Math.max(0, Math.floor(ms / 1000));
            return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
          };
          const inWindow = nowTick >= win.startMs && nowTick < win.endMs;

          return (
            <div className="searching-card" style={{ marginBottom: 12, textAlign: 'center' }}>
              <p style={{ color: '#7c6ff7', fontWeight: 700, fontSize: '15px', margin: '0 0 6px' }}>
                {sessionTitle} • {startLabel}
              </p>
              {nowTick < win.startMs && (
                <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
                  Başlamasına qalıb: <b>{fmtLeft(win.startMs - nowTick)}</b>
                </p>
              )}
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
    </div>
  );
}
