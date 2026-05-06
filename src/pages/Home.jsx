import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [requests, setRequests] = useState([]);
  const [connections, setConnections] = useState([]);
  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const [sentRequests, setSentRequests] = useState([]);
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
        return (now - u.lastSeen.toMillis?.()) < 90000;
      });
      setOnlineUsers(list);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid));
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
    const q = query(collection(db, 'requests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'requests'), where('fromUid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setSentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'connections'), where('users', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setConnections(snap.docs.map(d => d.data()));
    });
    return unsub;
  }, [user]);

  const isConnected = (otherUid) => {
    return connections.some(c => c.users.includes(otherUid));
  };

  const requestSent = (otherUid) => {
    return sentRequests.some(r => r.toUid === otherUid && r.status === 'pending');
  };

  const handleChatClick = async (targetUser) => {
    if (isConnected(targetUser.uid)) {
      navigate(`/chat/${targetUser.uid}`);
      return;
    }
    if (requestSent(targetUser.uid)) {
      alert('Sorğu artıq göndərilib, cavab gözlənilir...');
      return;
    }
    const requestId = `${user.uid}_${targetUser.uid}`;
    await setDoc(doc(db, 'requests', requestId), {
      fromUid: user.uid,
      fromName: user.displayName || 'User',
      toUid: targetUser.uid,
      toName: targetUser.name,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    alert(`📨 Sorğu göndərildi → ${targetUser.name}`);
  };

  const acceptRequest = async (req) => {
    await setDoc(doc(db, 'requests', req.id), { status: 'accepted' }, { merge: true });
    const connId = [req.fromUid, req.toUid].sort().join('_');
    await setDoc(doc(db, 'connections', connId), {
      users: [req.fromUid, req.toUid],
      createdAt: serverTimestamp(),
    });
    navigate(`/chat/${req.fromUid}`);
  };

  const rejectRequest = async (req) => {
    await setDoc(doc(db, 'requests', req.id), { status: 'rejected' }, { merge: true });
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

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleShare = () => {
    const text = `🎙️ Speak2Them — İngiliscəni real insanlarla məşq et!\n\n✅ Online partnyor tap\n✅ Audio zəng et\n✅ Gündəlik mövzular\n✅ Tamamilə pulsuz\n\n👉 t.me/Speak2them_bot/app`;
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=https://t.me/Speak2them_bot/app&text=${encodeURIComponent(text)}`);
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Link kopyalandı!'));
    }
  };

  const findRandomPartner = async () => {
    const now = Date.now();
    let list = onlineUsers.filter(u => {
      const lastSeen = u.lastSeen?.toMillis?.() || 0;
      return (now - lastSeen) < 90000;
    });
    if (levelFilter !== 'All') list = list.filter(u => u.level === levelFilter);
    if (list.length === 0) { alert('No one online with this level!'); return; }
    const random = list[Math.floor(Math.random() * list.length)];
    handleChatClick(random);
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
        <div className="home-header-right">
          <button className="btn-profile" onClick={() => navigate('/daily')}>📅 Daily</button>
          <button className="btn-profile" onClick={() => navigate('/profile')}>👤 Profile</button>
          <button className="btn-profile" onClick={handleShare}>📢 Share</button>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="home-body">

        {requests.length > 0 && (
          <div style={{
            background: '#1e1e30',
            border: '1px solid #7c6ff755',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '24px',
          }}>
            <p style={{ fontWeight: 700, marginBottom: '12px', color: '#7c6ff7' }}>
              📨 Mesaj Sorğuları ({requests.length})
            </p>
            {requests.map(req => (
              <div key={req.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid #2e2e50',
                gap: '12px',
                flexWrap: 'wrap',
              }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{req.fromName}</p>
                  <p style={{ fontSize: '13px', color: '#888' }}>sizinlə danışmaq istəyir</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-accept" onClick={() => acceptRequest(req)}>✅ Qəbul</button>
                  <button className="btn-reject" onClick={() => rejectRequest(req)}>❌ Rədd</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{
          background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
          border: '1px solid #7c6ff755',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>👥 Dostlarını dəvət et!</p>
            <p style={{ color: '#aaa', fontSize: '13px' }}>Hər gün 15:00 və 21:00 — toplu qoşulma vaxtları 🕒</p>
          </div>
          <button className="btn-chat" style={{ whiteSpace: 'nowrap', padding: '12px 20px' }} onClick={handleShare}>
            📢 Paylaş
          </button>
        </div>

        <button className="btn-random" onClick={findRandomPartner}>🎲 Find Random Partner</button>

        <div className="tabs">
          <button className={`tab ${tab === 'online' ? 'active' : ''}`} onClick={() => setTab('online')}>
            🟢 Online ({onlineUsers.length})
          </button>
          <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            👥 All Users ({allUsers.length})
          </button>
        </div>

        <div className="level-filter">
          {LEVELS.map(l => (
            <button key={l} className={`level-btn ${levelFilter === l ? 'active' : ''}`} onClick={() => setLevelFilter(l)}>
              {l === 'All' ? '🌐 All' : l.split(' – ')[0]}
            </button>
          ))}
        </div>

        {displayUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">😴</div>
            <p>{tab === 'online' ? 'No one online with this level.' : 'No users yet.'}</p>
          </div>
        ) : (
          <div className="users-grid">
            {displayUsers.map(u => (
              <div key={u.uid} className="user-card">
                <div className="user-avatar">
                  {u.photo
                    ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    : u.name?.charAt(0).toUpperCase()
                  }
                </div>
                <div className="user-info">
                  <h3>{u.name}</h3>
                  <span className="user-level">{u.level || 'English Speaker'}</span>
                  {u.bio && <p className="user-bio">{u.bio}</p>}
                  <div className="user-stats-row">
                    <span className="user-stat">📞 {u.callCount || 0} calls</span>
                    <span className="user-stat">🕐 {u.totalMinutes || 0} min</span>
                    <span className="user-stat">🔥 {u.streak || 0} streak</span>
                  </div>
                  <span className={`online-badge ${u.lastSeen?.toMillis?.() > Date.now() - 90000 ? 'online' : 'offline'}`}>
                    {u.lastSeen?.toMillis?.() > Date.now() - 90000 ? '🟢 Online' : '⚫ Offline'}
                  </span>
                </div>
                <button
                  className="btn-chat"
                  onClick={() => handleChatClick(u)}
                  style={{ opacity: requestSent(u.uid) ? 0.6 : 1 }}
                >
                  {isConnected(u.uid) ? '💬 Yaz / Zəng et' : requestSent(u.uid) ? '⏳ Sorğu gözlənilir' : '💬 Sorğu göndər'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}