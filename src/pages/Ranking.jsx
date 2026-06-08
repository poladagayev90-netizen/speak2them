import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import HomeRanking from '../components/HomeRanking';

export default function Ranking({ user }) {
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
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
