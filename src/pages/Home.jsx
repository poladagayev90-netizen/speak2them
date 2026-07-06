import React, { useEffect, useState, useCallback } from 'react';
import { collection, doc, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

import DailyTopicModal from '../components/DailyTopicModal';
import TopicDecorations from '../components/TopicDecorations';
import { getTodayContent } from '../data/weeklyContent';
import { AchievementsPanel } from '../components/BadgeSystem';
import Logo from '../components/Logo';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { ADMIN_UID } from '../constants';
import { Award, Shuffle, Search, X, Globe, Shield, BookOpen } from 'lucide-react';

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const [userBadges, setUserBadges] = useState(user.badges || []);
  const [dailyTopicOpen, setDailyTopicOpen] = useState(false);
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



  // ✅ Optimized — yalnız son 3 dəqiqədə aktiv olan 50 user
  useEffect(() => {
    const cutoff = new Date(Date.now() - 180000);
    const q = query(
      collection(db, 'users'),
      where('lastSeen', '>', cutoff),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
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
        if (now - lastSeen < 180000 || u.uid === ADMIN_UID) online.push(u);
      });
      setOnlineUsers(online);
      setAllUsers(all);
    });
    return unsub;
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

        <button
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

        {searching && (
          <div className="searching-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
              <Search size={16} color="#7c6ff7" />
              <p style={{ color: '#7c6ff7', fontWeight: 600, fontSize: '14px' }}>Uyğun partnyor axtarılır...</p>
            </div>
            <p style={{ color: '#666', fontSize: '12px' }}>Birisi sizi tapanda avtomatik qoşulacaqsınız</p>
          </div>
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
                      <span className={`online-badge ${u.lastSeen?.toMillis?.() > Date.now() - 180000 ? 'online' : 'offline'}`}>
                        {u.lastSeen?.toMillis?.() > Date.now() - 180000 ? '🟢 Online' : '⚫ Offline'}
                      </span>
                    </div>

                    <button
                      className="btn-chat"
                      onClick={() => {
                        if (!user.isPremium) {
                          navigate('/upgrade');
                          return;
                        }
                        navigate(`/chat/${u.uid || u.id}`);
                      }}
                      style={{
                        background: !user.isPremium
                          ? 'linear-gradient(135deg, #7c6ff7, #5a4de3)'
                          : undefined,
                      }}
                    >
                      {user.isPremium ? '💬 Chat & Call' : '⭐ Get Pro'}
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
