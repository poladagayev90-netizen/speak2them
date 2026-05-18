import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function MatchMaking({ user }) {
  const [candidates, setCandidates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const navigate = useNavigate();

  const startX = useRef(0);

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
    // eslint-disable-next-line
  }, []);

  // 🖱️ MOUSE
  const handleMouseDown = (e) => {
    setDragging(true);
    startX.current = e.clientX;
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    setPos({ x: dx, y: 0 });
  };

  const handleMouseUp = () => {
    setDragging(false);

    if (pos.x > 120) handleAccept(currentUserCard);
    if (pos.x < -120) handleSkip();

    setPos({ x: 0, y: 0 });
  };

  // 📱 TOUCH
  const handleTouchStart = (e) => {
    setDragging(true);
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX.current;
    setPos({ x: dx, y: 0 });
  };

  const handleTouchEnd = () => {
    setDragging(false);

    if (pos.x > 120) handleAccept(currentUserCard);
    if (pos.x < -120) handleSkip();

    setPos({ x: 0, y: 0 });
  };

  const handleSkip = () => {
    setCurrentIndex(prev => prev + 1);
  };

  const handleAccept = (target) => {
    navigate(`/chat/${target.uid}`);
  };

  if (candidates.length === 0) {
    return <div className="home-page"><h2>No users 😴</h2></div>;
  }

  const currentUserCard = candidates[currentIndex];

  if (!currentUserCard) {
    return <div className="home-page"><h2>No more 😴</h2></div>;
  }

  return (
    <div className="home-page">

      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          maxWidth: '400px',
          margin: '40px auto',
          background: '#1e1e30',
          borderRadius: '20px',
          padding: '24px',
          textAlign: 'center',

          transform: `translateX(${pos.x}px) rotate(${pos.x / 15}deg)`,
          transition: dragging ? 'none' : 'all 0.3s ease',
          cursor: 'grab'
        }}
      >

        {/* ✅ LIKE / NOPE */}
        {pos.x > 80 && (
          <div style={{ color: '#22c55e', fontWeight: 800 }}>
            ✅ LIKE
          </div>
        )}

        {pos.x < -80 && (
          <div style={{ color: '#ef4444', fontWeight: 800 }}>
            ❌ NOPE
          </div>
        )}

        <div className="user-avatar" style={{ marginBottom: '12px' }}>
          {currentUserCard.photo
            ? <img src={currentUserCard.photo} alt="" style={{ width: '100%', borderRadius: '50%' }} />
            : currentUserCard.name?.charAt(0).toUpperCase()
          }
        </div>

        <h2>{currentUserCard.name}</h2>
        <p>{currentUserCard.level}</p>

        <p style={{ color: '#7c6ff7', fontWeight: 700 }}>
          Match: {currentUserCard.score}%
        </p>

        <p style={{ fontSize: '13px', color: '#aaa' }}>
          {currentUserCard.goal}
        </p>

      </div>
    </div>
  );
}