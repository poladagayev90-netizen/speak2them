import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

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
        const lastSeen = u.lastSeen.toMillis?.() || 0;
        return (now - lastSeen) < 90000;
      });
      setOnlineUsers(list);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid);
      setAllUsers(list);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'calling')
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const callData = snap.docs[0].data();
        callData.callDocId = snap.docs[0].id;
        setIncomingCall(callData);
        try { ringtoneRef.current?.play(); } catch (e) {}
      } else {
        setIncomingCall(null);
        ringtoneRef.current?.pause();
      }
    });
    return unsub;
  }, [user]);

  const acceptCall = async () => {
    ringtoneRef.current?.pause();
    const callerId = incomingCall.callerId;
    const callDocId = incomingCall.callDocId;
    await setDoc(doc(db, 'calls', callDocId), { status: 'accepted' }, { merge: true });
    setIncomingCall(null);
    navigate(`/chat/${callerId}`, { state: { acceptedCall: true } });
  };

  const rejectCall = async () => {
    ringtoneRef.current?.pause();
    await deleteDoc(doc(db, 'calls', incomingCall.callDocId));
    setIncomingCall(null);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const findRandomPartner = async () => {
    const q = query(collection(db, 'users'), where('online', '==', true));
    const snapshot = await getDocs(q);
    const now = Date.now();
    let list = snapshot.docs.map(d => d.data()).filter(u => {
      if (u.uid === user.uid) return false;
      const lastSeen = u.lastSeen?.toMillis?.() || 0;
      return (now - lastSeen) < 90000;
    });
    if (levelFilter !== 'All') {
      list = list.filter(u => u.level === levelFilter);
    }
    if (list.length === 0) {
      alert('No one online with this level. Try another filter!');
      return;
    }
    const random = list[Math.floor(Math.random() * list.length)];
    navigate(`/chat/${random.uid}`);
  };

  const baseList = tab === 'online' ? onlineUsers : allUsers;
  const displayUsers = levelFilter === 'All'
    ? baseList
    : baseList.filter(u => u.level === levelFilter);

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
        <div className="home-header-right">
          <button className="btn-profile" onClick={() => navigate('/daily')}>📅 Daily</button>
          <button className="btn-profile" onClick={() => navigate('/profile')}>👤 Profile</button>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="home-body">
        <button className="btn-random" onClick={findRandomPartner}>
          🎲 Find Random Partner
        </button>

        <div className="tabs">
          <button className={`tab ${tab === 'online' ? 'active' : ''}`} onClick={() => setTab('online')}>
            🟢 Online ({onlineUsers.length})
          </button>
          <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            👥 All Users ({allUsers.length})
          </button>
        </div>

        {/* SEVİYYƏ FİLTRİ */}
        <div className="level-filter">
          {LEVELS.map(l => (
            <button
              key={l}
              className={`level-btn ${levelFilter === l ? 'active' : ''}`}
              onClick={() => setLevelFilter(l)}
            >
              {l === 'All' ? '🌐 All' : l.split(' – ')[0]}
            </button>
          ))}
        </div>

        {displayUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">😴</div>
            <p>{tab === 'online' ? 'No one online with this level.' : 'No users with this level.'}</p>
            <p>Try another filter!</p>
          </div>
        ) : (
          <div className="users-grid">
            {displayUsers.map(u => (
              <div key={u.uid} className="user-card">
                <div className="user-avatar">
                  {u.photo ? (
                    <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                  ) : (
                    u.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="user-info">
                  <h3>{u.name}</h3>
                  <span className="user-level">{u.level || 'English Speaker'}</span>
                  {u.bio && <p className="user-bio">{u.bio}</p>}
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
      </div>
    </div>
  );
}