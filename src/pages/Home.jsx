import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [tab, setTab] = useState('online');
  const navigate = useNavigate();

  // Online istifadəçiləri dinlə — lastSeen 90 saniyədən az olanlar
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const now = Date.now();
      const list = snap.docs
        .map(d => d.data())
        .filter(u => {
          if (u.uid === user.uid) return false;
          if (!u.lastSeen) return false;
          const lastSeen = u.lastSeen.toMillis?.() || 0;
          return (now - lastSeen) < 90000; // 90 saniyə
        });
      setOnlineUsers(list);
    });
    return unsub;
  }, [user]);

  // Bütün istifadəçiləri dinlə
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid);
      setAllUsers(list);
    });
    return unsub;
  }, [user]);

  // Gələn zəngləri dinlə
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
      } else {
        setIncomingCall(null);
      }
    });
    return unsub;
  }, [user]);

  const acceptCall = async () => {
    const callerId = incomingCall.callerId;
    const callDocId = incomingCall.callDocId;
    await setDoc(doc(db, 'calls', callDocId), {
      status: 'accepted',
    }, { merge: true });
    setIncomingCall(null);
    navigate(`/chat/${callerId}`, { state: { acceptedCall: true } });
  };

  const rejectCall = async () => {
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
    const list = snapshot.docs
      .map(d => d.data())
      .filter(u => {
        if (u.uid === user.uid) return false;
        const lastSeen = u.lastSeen?.toMillis?.() || 0;
        return (now - lastSeen) < 90000;
      });
    if (list.length === 0) {
      alert('No one online right now. Try again!');
      return;
    }
    const random = list[Math.floor(Math.random() * list.length)];
    navigate(`/chat/${random.uid}`);
  };

  const displayUsers = tab === 'online' ? onlineUsers : allUsers;

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
          <span className="home-username">👤 {user.displayName || 'User'}</span>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="home-body">
        <button className="btn-random" onClick={findRandomPartner}>
          🎲 Find Random Partner
        </button>

        <div className="tabs">
          <button
            className={`tab ${tab === 'online' ? 'active' : ''}`}
            onClick={() => setTab('online')}
          >
            🟢 Online ({onlineUsers.length})
          </button>
          <button
            className={`tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            👥 All Users ({allUsers.length})
          </button>
        </div>

        {displayUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">😴</div>
            <p>{tab === 'online' ? 'No one is online right now.' : 'No users yet.'}</p>
            <p>Share the app with friends!</p>
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
                  <span className={`online-badge ${tab === 'online' || u.lastSeen?.toMillis?.() > Date.now() - 90000 ? 'online' : 'offline'}`}>
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