import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import IncomingCallModal from '../components/IncomingCallModal';
import UserCard from '../components/UserCard';
import HomeRanking from '../components/HomeRanking';
import { Mic, Shuffle, Search, X, Globe, Shield } from 'lucide-react';

const LEVELS = ['All', 'A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

const LEVEL_MATCHING_MIN_USERS = 10;
const LEVEL_RANK = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

const getLevelCode = (level = '') => {
  const match = String(level).match(/^(A1|A2|B1|B2|C1|C2)\b/);
  return match ? match[1] : null;
};

const getLevelRank = (level) => {
  const code = getLevelCode(level);
  return code ? LEVEL_RANK[code] : null;
};

const levelDistance = (a, b) => {
  const rankA = getLevelRank(a);
  const rankB = getLevelRank(b);
  if (rankA === null || rankB === null) return 99;
  return Math.abs(rankA - rankB);
};

const targetAllowsLevel = (targetLevel, candidateLevel) => {
  if (!targetLevel || targetLevel === 'All' || targetLevel === 'Any') return true;
  return getLevelCode(targetLevel) === getLevelCode(candidateLevel);
};

const preferenceAllowsLevel = (ownerLevel, partnerLevel, preference = 'Any') => {
  const ownerRank = getLevelRank(ownerLevel);
  const partnerRank = getLevelRank(partnerLevel);
  if (ownerRank === null || partnerRank === null) return true;
  if (preference === 'Same') return ownerRank === partnerRank;
  if (preference === 'Higher') return partnerRank > ownerRank;
  return true;
};

const scoreCandidate = (candidate, currentUser, requestedLevel) => {
  const distance = levelDistance(currentUser.level, candidate.level);
  const distanceScore = distance === 99 ? 5 : Math.max(0, 80 - distance * 25);
  const exactRequestedBonus = requestedLevel !== 'All' && targetAllowsLevel(requestedLevel, candidate.level) ? 35 : 0;
  const mutualTargetBonus = targetAllowsLevel(candidate.desiredLevel, currentUser.level) ? 20 : 0;
  const joinedAt = candidate.joinedAt?.toMillis?.() || 0;
  const waitBonus = joinedAt ? Math.min(15, Math.floor((Date.now() - joinedAt) / 60000)) : 0;

  return distanceScore + exactRequestedBonus + mutualTargetBonus + waitBonus + Math.random();
};

const pickBestLevelMatch = (candidates, currentUser, requestedLevel) => {
  const strictMatches = candidates.filter(candidate =>
    targetAllowsLevel(requestedLevel, candidate.level) &&
    targetAllowsLevel(candidate.desiredLevel, currentUser.level) &&
    preferenceAllowsLevel(currentUser.level, candidate.level, currentUser.partnerPreference) &&
    preferenceAllowsLevel(candidate.level, currentUser.level, candidate.partnerPreference)
  );

  const fallbackMatches = candidates.filter(candidate =>
    targetAllowsLevel(requestedLevel, candidate.level) &&
    targetAllowsLevel(candidate.desiredLevel, currentUser.level)
  );

  const pool = strictMatches.length > 0 ? strictMatches : fallbackMatches;
  if (pool.length === 0) return null;

  return [...pool]
    .sort((a, b) => scoreCandidate(b, currentUser, requestedLevel) - scoreCandidate(a, currentUser, requestedLevel))[0];
};

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
  const userLevel = user.level || 'Any';
  const userName = user.displayName || user.name || 'User';
  const userPartnerPreference = user.partnerPreference || 'Any';

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3');
    audio.loop = true;
    ringtoneRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  // ✅ YALNIZ BU useEffect — lastSeen ilə online yoxla
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const now = Date.now();
      const online = [];
      const all = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const u = { id: d.id, ...data, uid: data.uid || d.id };
        all.push(u);
        if (u.uid === user.uid || u.id === user.uid) return;
        if (!u.lastSeen) return;
        const lastSeen = u.lastSeen.toMillis?.() || 0;
const ADMIN_UID = '6Djehd9KB8dTZUgVwVJfLoPI5dF3';
if (now - lastSeen < 180000 || u.uid === ADMIN_UID) online.push(u);
      });
      setOnlineUsers(online);
      setAllUsers(all);
    });
    return unsub;
  }, [user.uid]);

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
  }, [user.uid]);

  const cancelSearch = useCallback(async () => {
    setSearching(false);
    if (searchUnsubRef.current) {
      searchUnsubRef.current();
      searchUnsubRef.current = null;
    }
    try { await deleteDoc(doc(db, 'matchQueue', user.uid)); } catch (e) {}
  }, [user.uid]);

  const findRandomPartner = useCallback(async () => {
    if (!user.uid) return;
    if (searching) { await cancelSearch(); return; }
    setSearching(true);
    try {
      const queueSnap = await getDocs(
        query(collection(db, 'matchQueue'), where('status', '==', 'waiting'), where('uid', '!=', user.uid))
      );
      const candidates = queueSnap.docs.map(d => d.data());
      const useLevelMatching = allUsers.length >= LEVEL_MATCHING_MIN_USERS;
      const match = useLevelMatching
        ? pickBestLevelMatch(candidates, {
            level: userLevel,
            partnerPreference: userPartnerPreference,
          }, levelFilter)
        : candidates[Math.floor(Math.random() * candidates.length)];
      if (match) {
        await setDoc(doc(db, 'matchQueue', match.uid), { status: 'matched', matchedWith: user.uid, matchedAt: serverTimestamp() }, { merge: true });
        await setDoc(doc(db, 'matchQueue', user.uid), { status: 'matched', matchedWith: match.uid, matchedAt: serverTimestamp() }, { merge: true });
        setSearching(false);
        navigate(`/chat/${match.uid}`);
        return;
      }
      await setDoc(doc(db, 'matchQueue', user.uid), {
        uid: user.uid,
        name: userName,
        level: userLevel,
        desiredLevel: allUsers.length >= LEVEL_MATCHING_MIN_USERS ? levelFilter : 'Any',
        partnerPreference: allUsers.length >= LEVEL_MATCHING_MIN_USERS ? userPartnerPreference : 'Any',
        status: 'waiting',
        joinedAt: serverTimestamp(),
      }, { merge: true });
      const unsub = onSnapshot(doc(db, 'matchQueue', user.uid), async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === 'matched' && data.matchedWith) {
          setSearching(false);
          if (searchUnsubRef.current) { searchUnsubRef.current(); searchUnsubRef.current = null; }
          try { await deleteDoc(doc(db, 'matchQueue', user.uid)); } catch (e) {}
          navigate(`/chat/${data.matchedWith}`);
        }
      });
      searchUnsubRef.current = unsub;
    } catch (error) {
      setSearching(false);
      alert('Error: ' + error.message);
    }
  }, [allUsers.length, searching, levelFilter, user.uid, userName, userLevel, userPartnerPreference, navigate, cancelSearch]);

  useEffect(() => {
    return () => { cancelSearch(); };
  }, [cancelSearch]);

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
        {user.uid === '6Djehd9KB8dTZUgVwVJfLoPI5dF3' && (
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
          className="btn-random"
          onClick={searching ? cancelSearch : findRandomPartner}
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
          <div style={{
            background: '#1e1e30', border: '1px solid #7c6ff755',
            borderRadius: '16px', padding: '16px', marginTop: '10px', textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
              <Search size={16} color="#7c6ff7" />
              <p style={{ color: '#7c6ff7', fontWeight: 600, fontSize: '14px' }}>Uyğun partnyor axtarılır...</p>
            </div>
            <p style={{ color: '#666', fontSize: '12px' }}>Birisi sizi tapanda avtomatik qoşulacaqsınız</p>
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
                  <UserCard key={u.id || u.uid} user={u} onChat={(uid) => navigate(`/chat/${uid}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
