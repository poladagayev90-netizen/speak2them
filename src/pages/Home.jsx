import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

const PremiumBadge = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#1a1000', fontSize: '10px', fontWeight: 700,
    padding: '2px 7px', borderRadius: '20px', marginLeft: '6px',
    boxShadow: '0 0 8px #f59e0b55',
  }}>👑 Premium</span>
);

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const [searching, setSearching] = useState(false);
  const [loadingRankings, setLoadingRankings] = useState(true);
  const navigate = useNavigate();
  const ringtoneRef = useRef(null);
  const searchUnsubRef = useRef(null);

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3');
    audio.loop = true;
    ringtoneRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const now = Date.now();
      const list = snap.docs.map(d => d.data()).filter(u => {
        if (u.uid === user.uid) return false;
        if (!u.lastSeen) return false;
        return (now - u.lastSeen.toMillis?.()) < 90000;
      });
      setOnlineUsers(list);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid));
      setLoadingRankings(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'calls'), where('receiverId', '==', user.uid), where('status', '==', 'calling'));
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
  }, [user]);

  useEffect(() => {
    return () => { cancelSearch(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelSearch = async () => {
    setSearching(false);
    if (searchUnsubRef.current) {
      searchUnsubRef.current();
      searchUnsubRef.current = null;
    }
    try { await deleteDoc(doc(db, 'matchQueue', user.uid)); } catch (e) {}
  };

  const findRandomPartner = async () => {
    if (searching) { await cancelSearch(); return; }
    setSearching(true);

    const queueSnap = await getDocs(
      query(collection(db, 'matchQueue'), where('status', '==', 'waiting'), where('uid', '!=', user.uid))
    );

    let candidates = queueSnap.docs.map(d => d.data());
    if (levelFilter !== 'All') {
      const same = candidates.filter(c => c.level === levelFilter);
      if (same.length > 0) candidates = same;
    }

    if (candidates.length > 0) {
      const match = candidates[Math.floor(Math.random() * candidates.length)];
      await setDoc(doc(db, 'matchQueue', match.uid), { status: 'matched', matchedWith: user.uid }, { merge: true });
      setSearching(false);
      navigate(`/chat/${match.uid}`);
      return;
    }

    await setDoc(doc(db, 'matchQueue', user.uid), {
      uid: user.uid,
      name: user.displayName || 'User',
      level: levelFilter !== 'All' ? levelFilter : 'Any',
      status: 'waiting',
      joinedAt: serverTimestamp(),
    });

    const unsub = onSnapshot(doc(db, 'matchQueue', user.uid), async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === 'matched' && data.matchedWith) {
        setSearching(false);
        if (searchUnsubRef.current) { searchUnsubRef.current(); searchUnsubRef.current = null; }
        await deleteDoc(doc(db, 'matchQueue', user.uid));
        navigate(`/chat/${data.matchedWith}`);
      }
    });
    searchUnsubRef.current = unsub;
  };

  const acceptCall = async () => {
    ringtoneRef.current?.pause();
    await setDoc(doc(db, 'calls', incomingCall.callDocId), { status: 'accepted' }, { merge: true });
    setIncomingCall(null);
    navigate(`/chat/${incomingCall.callerId}`, { state: { acceptedCall: true } });
  };

  const rejectCall = async () => {
    ringtoneRef.current?.pause();
    await deleteDoc(doc(db, 'calls', incomingCall.callDocId));
    setIncomingCall(null);
  };

  const baseList = tab === 'online' ? onlineUsers : allUsers;
  const displayUsers = levelFilter === 'All' ? baseList : baseList.filter(u => u.level === levelFilter);

  return (
    <div className="home-page">

      {incomingCall && (
        <div className="incoming-call">
          <p>📞 {incomingCall.callerName} sizi zəng edir...</p>
          <div className="incoming-call-buttons">
            <button className="btn-accept" onClick={acceptCall}>✅ Qəbul et</button>
            <button className="btn-reject" onClick={rejectCall}>❌ Rədd et</button>
          </div>
        </div>
      )}

      <div className="home-header">
        <div className="home-logo">🎙️ Speak2Them</div>
        {user.uid === '6Djehd9KB8dTZUgVwVJfLoPI5dF3' && (
          <button onClick={() => navigate('/admin')} style={{
            background: '#2e2e50', color: '#7c6ff7', border: '1px solid #7c6ff755',
            borderRadius: '10px', padding: '6px 12px', fontWeight: 700,
            fontSize: '12px', cursor: 'pointer',
          }}>🛡️ Admin</button>
        )}
      </div>

      <div className="home-body">

        <button
          className="btn-random"
          onClick={searching ? cancelSearch : findRandomPartner}
          style={{ background: searching ? 'linear-gradient(135deg, #ef4444, #dc2626)' : undefined }}
        >
          {searching ? '⏳ Axtarılır... (ləğv et)' : '🎲 Find Random Partner'}
        </button>

        {searching && (
          <div style={{
            background: '#1e1e30', border: '1px solid #7c6ff755',
            borderRadius: '16px', padding: '16px', marginTop: '10px', textAlign: 'center',
          }}>
            <p style={{ color: '#7c6ff7', fontWeight: 600, fontSize: '14px' }}>
              🔍 Uyğun partnyor axtarılır...
            </p>
            <p style={{ color: '#666', fontSize: '12px', marginTop: '6px' }}>
              Birisi sizi tapanda avtomatik qoşulacaqsınız
            </p>
          </div>
        )}

        <div className="tabs" style={{ marginTop: '16px' }}>
          <button className={`tab ${tab === 'online' ? 'active' : ''}`} onClick={() => setTab('online')}>
            🟢 Online ({onlineUsers.length})
          </button>
          <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            👥 All ({allUsers.length})
          </button>
          <button className={`tab ${tab === 'ranking' ? 'active' : ''}`} onClick={() => setTab('ranking')}>
            🏆 Rankings
          </button>
        </div>

        {tab !== 'ranking' && (
          <div className="level-filter">
            {LEVELS.map(l => (
              <button key={l} className={`level-btn ${levelFilter === l ? 'active' : ''}`} onClick={() => setLevelFilter(l)}>
                {l === 'All' ? '🌐 All' : l.split(' – ')[0]}
              </button>
            ))}
          </div>
        )}

        {tab === 'ranking' && (
          <div style={{ marginTop: '16px' }}>
            {loadingRankings ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <p>Loading rankings...</p>
              </div>
            ) : allUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏆</div>
                <p>No users found yet.</p>
              </div>
            ) : (
              [...allUsers]
                .sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0))
                .map((u, i) => (
                  <div key={u.uid} style={{
                    background: '#1e1e30',
                    border: `1px solid ${i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#2e2e50'}`,
                    borderRadius: '14px', padding: '14px 16px', marginBottom: '10px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}>
                    <div style={{
                      fontSize: '22px', fontWeight: 800, minWidth: '36px', textAlign: 'center',
                      color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#666',
                    }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>
                    <div className="user-avatar" style={{ width: '40px', height: '40px', minWidth: '40px' }}>
                      {u.photo
                        ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        : u.name?.charAt(0).toUpperCase()
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                        {u.name}{u.isPremium && <PremiumBadge />}
                      </p>
                      <p style={{ fontSize: '11px', color: '#888' }}>{u.level || 'English Speaker'}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, color: '#7c6ff7', fontSize: '15px' }}>{u.totalMinutes || 0} dəq</p>
                      <p style={{ fontSize: '11px', color: '#888' }}>{u.callCount || 0} zəng</p>
                      {u.streak > 0 && <p style={{ fontSize: '11px', color: '#f59e0b' }}>🔥 {u.streak}</p>}
                    </div>
                  </div>
                ))
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
                  <div key={u.uid} className="user-card" style={{
                    border: u.isPremium ? '1px solid #f59e0b55' : undefined,
                  }}>
                    <div className="user-avatar" style={{
                      boxShadow: u.isPremium ? '0 0 12px #f59e0b66' : undefined,
                    }}>
                      {u.photo
                        ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        : u.name?.charAt(0).toUpperCase()
                      }
                    </div>
                    <div className="user-info">
                      <h3 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                        {u.name}{u.isPremium && <PremiumBadge />}
                      </h3>
                      <span className="user-level">{u.level || 'English Speaker'}</span>
                      {u.bio && <p className="user-bio">{u.bio}</p>}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#888' }}>📞 {u.callCount || 0}</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>🕐 {u.totalMinutes || 0} dəq</span>
                        {u.streak > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>🔥 {u.streak}</span>}
                        {u.ratingCount > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>⭐ {(u.rating / u.ratingCount).toFixed(1)}</span>}
                      </div>
                      <span className={`online-badge ${u.lastSeen?.toMillis?.() > Date.now() - 90000 ? 'online' : 'offline'}`}>
                        {u.lastSeen?.toMillis?.() > Date.now() - 90000 ? '🟢 Online' : '⚫ Offline'}
                      </span>
                    </div>
                    <button className="btn-chat" onClick={() => navigate(`/chat/${u.uid}`)}>
                      💬 Chat & Call
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