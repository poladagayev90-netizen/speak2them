import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import HomeRanking from '../components/HomeRanking';

export default function Ranking({ user }) {
  const [allUsers, setAllUsers] = useState([]);

  // One-shot read: a leaderboard doesn't need realtime, and a live listener
  // on the whole collection re-streams every presence heartbeat to every
  // viewer (read amplification at scale).
  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, 'users')).then((snap) => {
      if (!cancelled) setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch((e) => console.error('[Ranking] load failed:', e));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">🏆 Rankings</div>
      </div>
      <div className="home-body" style={{ paddingBottom: '90px' }}>
        {allUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Loading rankings...</p>
          </div>
        ) : (
          <HomeRanking users={allUsers} currentUserId={user.uid} />
        )}
      </div>
    </div>
  );
}
