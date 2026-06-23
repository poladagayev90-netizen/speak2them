import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import IncomingCallModal from '../components/IncomingCallModal';
import HomeRanking from '../components/HomeRanking';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { ADMIN_UID } from '../constants';
import { Mic, Shuffle, Search, X, Globe, Shield } from 'lucide-react';

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const navigate = useNavigate();
  const ringtoneRef = useRef(null);

  const handleMatched = useCallback((partnerUid) => {
    navigate(`/chat/${partnerUid}`);
  }, [navigate]);

  const { searching, startSearch, cancelSearch, compensationMsg } = useMatchmaking({
    user,
    levelFilter,
    totalUsers: allUsers.length,
    onMatched: handleMatched,
  });

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3');
    audio.loop = true;
    ringtoneRef.current = audio;
    return () => { audio.pause(); };
  }, []);

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

  useEffect(() => {
    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'calling')
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const callData = { ...snap.docs[0].data(), callDocId: snap.docs[0].id };
        setIncomingCall(callData);
        try { ringtoneRef.current?.play(); } catch (e) {}
      } else {
        setIncomingCall(null);
        ringtoneRef.current?.pause();
      }
    });
    return unsub;
  }, [user.uid]);

  useEffect(() => () => { cancelSearch(); }, [cancelSearch]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall?.callDocId) return;
    ringtoneRef.current?.pause();
    await setDoc(doc(db, 'calls', incomingCall.callDocId), { status: 'accepted' }, { merge: true });
    setIncomingCall(null);
    navigate(`/chat/${incomingCall.callerId}`, { state: { acceptedCall: true } });
  }, [incomingCall, navigate]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall?.callDocId) return;
    ringtoneRef.current?.pause();
    await deleteDoc(doc(db, 'calls', incomingCall.callDocId));
    setIncomingCall(null);
  }, [incomingCall]);

  const browsableUsers = allUsers.filter(u => u.uid !== user.uid && u.id !== user.uid);
  const baseList = tab === 'online' ? onlineUsers : browsableUsers;
  const displayUsers = levelFilter === 'All' ? baseList : baseList.filter(u => u.level === levelFilter);

  return (
    <div className="home-page">
      <IncomingCallModal call={incomingCall} onAccept={acceptCall} onReject={rejectCall} />

      <div className="home-header">
        <div className="home-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mic size={18} color="#7c6ff7" strokeWidth={2.5} />
          Speak2Them
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
          </div>
        )}

        <div className="tabs" style={{ marginTop: '16px' }}>
          <button className={`tab ${tab === 'online' ? 'active' : ''}`} onClick={() => setTab('online')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: tab === 'online' ? '#fff' : '#22c55e', display: 'inline-block' }} />
              Online ({onlineUsers.length})
            </span>
          </button>
          <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            All ({browsableUsers.length})
          </button>
          <button className={`tab ${tab === 'ranking' ? 'active' : ''}`} onClick={() => setTab('ranking')}>
            🏆 Rankings
          </button>
        </div>

        {tab !== 'ranking' && (
          <div className="level-filter">
            {LEVELS.map(l => (
              <button key={l} className={`level-btn ${levelFilter === l ? 'active' : ''}`} onClick={() => setLevelFilter(l)}>
                {l === 'All' ? <><Globe size={12} style={{ marginRight: 4 }} />All</> : l.split(' – ')[0]}
              </button>
            ))}
          </div>
        )}

        {tab === 'ranking' && (
          <div style={{ marginTop: '16px' }}>
            {allUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <p>Loading rankings...</p>
              </div>
            ) : (
              <HomeRanking users={allUsers} currentUserId={user.uid} />
            )}
          </div>
        )}

        {tab !== 'ranking' && (
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
                          Premium ilə tam profil
                        </div>
                      )}
                      <span className="user-level">
                        {user.isPremium ? (u.level || 'English Speaker') : '???'}
                      </span>
                      {user.isPremium && u.bio && <p className="user-bio">{u.bio}</p>}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {user.isPremium ? (
                          <>
                            <span style={{ fontSize: '11px', color: '#888' }}>📞 {u.callCount || 0}</span>
                            <span style={{ fontSize: '11px', color: '#888' }}>🕐 {u.totalMinutes || 0} dəq</span>
                            {u.streak > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>🔥 {u.streak}</span>}
                            {u.ratingCount > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>⭐ {(u.rating / u.ratingCount).toFixed(1)}</span>}
                          </>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#7c6ff7' }}>👑 Premium al — tam gör</span>
                        )}
                      </div>
                      <span className={`online-badge ${u.lastSeen?.toMillis?.() > Date.now() - 15000 ? 'online' : 'offline'}`}>
                        {u.lastSeen?.toMillis?.() > Date.now() - 15000 ? '🟢 Online' : '⚫ Offline'}
                      </span>
                    </div>

                    <button
                      className="btn-chat"
                      onClick={() => {
                        if (!user.isPremium) {
                          alert('👑 Bu xüsusiyyət Premium üçündür!\n\nPremium al və bütün istifadəçilərlə danış!');
                          return;
                        }
                        navigate(`/chat/${u.uid || u.id}`);
                      }}
                      style={{
                        background: !user.isPremium
                          ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                          : undefined,
                      }}
                    >
                      {user.isPremium ? '💬 Chat & Call' : '👑 Premium Al'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}