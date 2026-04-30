import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, getDocs, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Home({ user }) {
  const [users, setUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const navigate = useNavigate();

  // Online istifadəçiləri dinlə
  useEffect(() => {
    const q = query(collection(db, 'users'), where('online', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid);
      setUsers(list);
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

  const acceptCall = () => {
    navigate(`/chat/${incomingCall.callerId}`);
    setIncomingCall(null);
  };

  const rejectCall = async () => {
    const { deleteDoc } = await import('firebase/firestore');
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
    const list = snapshot.docs.map(d => d.data()).filter(u => u.uid !== user.uid);
    if (list.length === 0) {
      alert('No one online right now. Try again!');
      return;
    }
    const random = list[Math.floor(Math.random() * list.length)];
    navigate(`/chat/${random.uid}`);
  };

  return (
    <div className="home-page">

      {/* Gələn zəng bildirişi */}
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

        <h2 style={{ marginTop: '32px' }}>🟢 Online Speakers ({users.length})</h2>
        <p className="home-sub">Choose someone to practice English with!</p>

        {users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">😴</div>
            <p>No one is online right now.</p>
            <p>Share the app with friends!</p>
          </div>
        ) : (
          <div className="users-grid">
            {users.map(u => (
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