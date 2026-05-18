import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function MatchMaking({ user }) {
  const [candidates, setCandidates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  const matchScore = (me, other) => {
    let score = 0;

    const overlap = (me.availableTimes || []).filter(t =>
      (other.availableTimes || []).includes(t)
    ).length;

    score += overlap * 40;

    if (me.goal === other.goal) score += 30;
    if (me.level === other.level) score += 20;

    const topicMatch = (me.topics || []).filter(t =>
      (other.topics || []).includes(t)
    ).length;

    score += topicMatch * 10;

    return Math.min(score, 100);
  };

  const loadCandidates = async () => {
    const snap = await getDocs(
      query(collection(db, 'users'), where('online', '==', true))
    );

    const list = snap.docs
      .map(d => d.data())
      .filter(u => u.uid !== auth.currentUser.uid);

    const scored = list.map(u => ({
      ...u,
      score: matchScore(user, u)
    }));

    scored.sort((a, b) => b.score - a.score);

    setCandidates(scored);
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const handleSkip = () => {
    setCurrentIndex(prev => prev + 1);
  };

  const handleAccept = (target) => {
    navigate(`/chat/${target.uid}`);
  };

  if (candidates.length === 0) {
    return (
      <div className="home-page">
        <h2>No users found 😴</h2>
      </div>
    );
  }

  const currentUserCard = candidates[currentIndex];

  if (!currentUserCard) {
    return (
      <div className="home-page">
        <h2>No more users 😴</h2>
      </div>
    );
  }

  return (
    <div className="home-page">

      <div style={{
        maxWidth: '400px',
        margin: '40px auto',
        background: '#1e1e30',
        borderRadius: '20px',
        padding: '24px',
        textAlign: 'center'
      }}>

        <div className="user-avatar" style={{ margin: '0 auto 12px' }}>
  {currentUserCard.photo ? (
    {currentUserCard.photo}
  ) : (
    currentUserCard.name?.charAt(0).toUpperCase()
  )}
</div>

        <h2>{currentUserCard.name}</h2>
        <p>{currentUserCard.level}</p>

        <p style={{ color: '#7c6ff7', fontWeight: 700 }}>
          Match: {currentUserCard.score}%
        </p>

        <p style={{ fontSize: '13px', color: '#aaa' }}>
          {currentUserCard.goal}
        </p>

        <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
          {currentUserCard.topics?.join(', ')}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginTop: '20px'
        }}>
          <button
            onClick={handleSkip}
            style={{
              background: '#ef4444',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '12px',
              color: '#fff'
            }}
          >
            ❌ Skip
          </button>

          <button
            onClick={() => handleAccept(currentUserCard)}
            style={{
              background: '#22c55e',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '12px',
              color: '#fff'
            }}
          >
            ✅ Accept
          </button>
        </div>

      </div>
    </div>
  );
}