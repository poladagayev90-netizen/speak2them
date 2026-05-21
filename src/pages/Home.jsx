import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import IncomingCallModal from '../components/IncomingCallModal';
import UserCard from '../components/UserCard';
import HomeRanking from '../components/HomeRanking';

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Home({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [tab, setTab] = useState('online');
  const [levelFilter, setLevelFilter] = useState('All');
  const [searching, setSearching] = useState(false);
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
    const q = query(collection(db, 'users'), where('online', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => d.data())
        .filter(u => u.uid !== user.uid);
      console.log('[Home] Online users updated:', list.length);
      setOnlineUsers(list);
    }, (error) => {
      console.error('[Home] Online users listener error:', error);
    });
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid);
      console.log('[Home] All users updated:', allUsers.length);
      setAllUsers(allUsers);
    }, (error) => {
      console.error('[Home] All users listener error:', error);
    });
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'calls'), where('receiverId', '==', user.uid), where('status', '==', 'calling'));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const callData = { ...snap.docs[0].data(), callDocId: snap.docs[0].id };
        console.log('[Home] Incoming call received');
        setIncomingCall(callData);
        try { ringtoneRef.current?.play(); } catch (e) {
          console.error('[Home] Audio play error:', e);
        }
      } else {
        setIncomingCall(null);
        ringtoneRef.current?.pause();
      }
    }, (error) => {
      console.error('[Home] Call listener error:', error);
    });
    return unsub;
  }, [user.uid]);

  const cancelSearch = useCallback(async () => {
    console.log('[Home] Canceling search');
    setSearching(false);
    if (searchUnsubRef.current) {
      searchUnsubRef.current();
      searchUnsubRef.current = null;
    }
    try {
      await deleteDoc(doc(db, 'matchQueue', user.uid));
      console.log('[Home] Removed from queue');
    } catch (e) {
      console.error('[Home] Error removing from queue:', e);
    }
  }, [user.uid]);

  const findRandomPartner = useCallback(async () => {
    if (!user.uid) {
      console.error('[Home] Cannot search - user.uid is missing');
      alert('User ID missing. Please refresh the page.');
      return;
    }

    if (searching) {
      console.log('[Home] Already searching, canceling...');
      await cancelSearch();
      return;
    }

    console.log('[Home] Starting partner search for user:', user.uid);
    setSearching(true);

    try {
      // First, check if there are any waiting users
      const queueSnap = await getDocs(
        query(collection(db, 'matchQueue'), where('status', '==', 'waiting'), where('uid', '!=', user.uid))
      );

      console.log('[Home] Found', queueSnap.size, 'waiting candidates');
      let candidates = queueSnap.docs.map(d => d.data());

      // Filter by level if specified
      if (levelFilter !== 'All') {
        const filtered = candidates.filter(c => c.level === levelFilter);
        if (filtered.length > 0) {
          candidates = filtered;
          console.log('[Home] Filtered to', candidates.length, 'by level:', levelFilter);
        }
      }

      if (candidates.length > 0) {
        // Pick a random candidate
        const match = candidates[Math.floor(Math.random() * candidates.length)];
        console.log('[Home] Found match:', match.uid);

        try {
          // Atomic match: Update the matched user first
          await setDoc(
            doc(db, 'matchQueue', match.uid),
            {
              status: 'matched',
              matchedWith: user.uid,
              matchedAt: serverTimestamp(),
              matchedBy: user.uid,
            },
            { merge: true }
          );
          console.log('[Home] Updated match queue for:', match.uid);

          // Then update current user
          await setDoc(
            doc(db, 'matchQueue', user.uid),
            {
              status: 'matched',
              matchedWith: match.uid,
              matchedAt: serverTimestamp(),
            },
            { merge: true }
          );
          console.log('[Home] Updated match queue for current user');

          setSearching(false);
          console.log('[Home] Navigating to chat with:', match.uid);
          navigate(`/chat/${match.uid}`);
          return;
        } catch (e) {
          console.error('[Home] Error in atomic match:', e);
          // Don't fail - continue to queue
        }
      }

      // No candidates found - add current user to queue
      console.log('[Home] No candidates found, adding to queue');
      await setDoc(
        doc(db, 'matchQueue', user.uid),
        {
          uid: user.uid,
          name: user.displayName || 'User',
          level: levelFilter !== 'All' ? levelFilter : 'Any',
          status: 'waiting',
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log('[Home] Added to queue, waiting for match...');

      // Listen for match
      const unsub = onSnapshot(doc(db, 'matchQueue', user.uid), async (snap) => {
        if (!snap.exists()) {
          console.log('[Home] Queue doc deleted');
          return;
        }

        const data = snap.data();
        console.log('[Home] Queue status:', data.status);

        if (data.status === 'matched' && data.matchedWith) {
          console.log('[Home] Match found! Connecting with:', data.matchedWith);
          setSearching(false);
          if (searchUnsubRef.current) {
            searchUnsubRef.current();
            searchUnsubRef.current = null;
          }
          try {
            await deleteDoc(doc(db, 'matchQueue', user.uid));
          } catch (e) {
            console.error('[Home] Error deleting from queue:', e);
          }
          navigate(`/chat/${data.matchedWith}`);
        }
      }, (error) => {
        console.error('[Home] Queue listener error:', error);
      });

      searchUnsubRef.current = unsub;
    } catch (error) {
      console.error('[Home] Error finding partner:', error);
      setSearching(false);
      alert('Error searching for partner: ' + error.message);
    }
  }, [searching, levelFilter, user.uid, user.displayName, navigate, cancelSearch]);

  useEffect(() => {
    return () => {
      console.log('[Home] Cleanup: canceling search');
      cancelSearch();
    };
  }, [cancelSearch]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    
    if (!incomingCall.callDocId || !incomingCall.callerId) {
      console.error('[Home] Invalid incoming call data');
      return;
    }

    try {
      console.log('[Home] Accepting call from:', incomingCall.callerId);
      ringtoneRef.current?.pause();
      await setDoc(
        doc(db, 'calls', incomingCall.callDocId),
        { status: 'accepted' },
        { merge: true }
      );
      console.log('[Home] Call accepted');
      setIncomingCall(null);
      navigate(`/chat/${incomingCall.callerId}`, { state: { acceptedCall: true } });
    } catch (error) {
      console.error('[Home] Error accepting call:', error);
      alert('Failed to accept call: ' + error.message);
    }
  }, [incomingCall, navigate]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall || !incomingCall.callDocId) {
      console.warn('[Home] No incoming call to reject');
      return;
    }

    try {
      console.log('[Home] Rejecting call');
      ringtoneRef.current?.pause();
      await deleteDoc(doc(db, 'calls', incomingCall.callDocId));
      console.log('[Home] Call rejected');
      setIncomingCall(null);
    } catch (error) {
      console.error('[Home] Error rejecting call:', error);
      alert('Failed to reject call: ' + error.message);
    }
  }, [incomingCall]);

  const baseList = tab === 'online' ? onlineUsers : allUsers;
  const displayUsers = levelFilter === 'All' ? baseList : baseList.filter(u => u.level === levelFilter);

  return (
    <div className="home-page">
      <IncomingCallModal call={incomingCall} onAccept={acceptCall} onReject={rejectCall} />

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
            <HomeRanking users={allUsers} />
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
                  <UserCard key={u.uid} user={u} onChat={(uid) => navigate(`/chat/${uid}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}