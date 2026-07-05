import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function MatchMaking({ user }) {
  const [candidates, setCandidates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pos, setPos] = useState({ x: 0 });
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const startX = useRef(0);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('online', '==', true),
        limit(30)
      );
      const snap = await getDocs(q);
      const now = Date.now();
      const list = snap.docs
        .map(d => d.data())
        .filter(u => {
          if (u.uid === user.uid) return false;
          if (u.status === 'busy') return false; // Hide busy users
          const lastSeen = u.lastSeen?.toMillis?.() || 0;
          return (now - lastSeen) < 180000;
        });
      setCandidates(list);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleStart = (x) => {
    setDragging(true);
    startX.current = x;
  };

  const handleMove = (x) => {
    if (!dragging) return;
    setPos({ x: x - startX.current });
  };

  const handleEnd = () => {
    setDragging(false);
    const current = candidates[currentIndex];
    if (pos.x > 120 && current) {
      navigate(`/chat/${current.uid}`);
    } else if (pos.x < -120) {
      setCurrentIndex(prev => prev + 1);
    }
    setPos({ x: 0 });
  };

  const current = candidates[currentIndex];

  if (loading) {
    return (
      <div className="home-page">
        <div className="home-header">
          <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
          <div className="home-logo">🎙️ Find Partner</div>
        </div>
        <div className="empty-state" style={{ marginTop: '80px' }}>
          <div className="empty-icon">⏳</div>
          <p>Yüklənir...</p>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="home-page">
        <div className="home-header">
          <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
          <div className="home-logo">🎙️ Find Partner</div>
          <button style={{ background: 'transparent', border: 'none', color: '#7c6ff7', cursor: 'pointer', fontSize: '20px' }} onClick={fetchUsers}>🔄</button>
        </div>
        <div className="empty-state" style={{ marginTop: '80px' }}>
          <div className="empty-icon">😴</div>
          <p>No one is online right now.</p>
          <p>Try again later!</p>
          <button className="btn-primary" style={{ marginTop: '16px' }} onClick={fetchUsers}>
            Yenilə
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="home-page">
        <div className="home-header">
          <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
          <div className="home-logo">🎙️ Find Partner</div>
          <button style={{ background: 'transparent', border: 'none', color: '#7c6ff7', cursor: 'pointer', fontSize: '20px' }} onClick={fetchUsers}>🔄</button>
        </div>
        <div className="empty-state" style={{ marginTop: '80px' }}>
          <div className="empty-icon">🔄</div>
          <p>You've seen everyone!</p>
          <button className="btn-primary" style={{ marginTop: '16px' }} onClick={fetchUsers}>
            Yenidən axtar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
        <div className="home-logo">🎙️ Find Partner</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#888' }}>{currentIndex + 1}/{candidates.length}</span>
          <button style={{ background: 'transparent', border: 'none', color: '#7c6ff7', cursor: 'pointer', fontSize: '20px' }} onClick={fetchUsers}>🔄</button>
        </div>
      </div>

      <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Swipe card */}
        <div
          onMouseDown={e => handleStart(e.clientX)}
          onMouseMove={e => handleMove(e.clientX)}
          onMouseUp={handleEnd}
          onTouchStart={e => handleStart(e.touches[0].clientX)}
          onTouchMove={e => handleMove(e.touches[0].clientX)}
          onTouchEnd={handleEnd}
          style={{
            width: '100%',
            maxWidth: '360px',
            background: '#1e1e30',
            border: '1px solid #2e2e50',
            borderRadius: '24px',
            padding: '32px 24px',
            textAlign: 'center',
            transform: `translateX(${pos.x}px) rotate(${pos.x / 20}deg)`,
            transition: dragging ? 'none' : 'all 0.3s ease',
            cursor: 'grab',
            userSelect: 'none',
            position: 'relative',
          }}
        >
          {/* LIKE / NOPE overlay */}
          {pos.x > 60 && (
            <div style={{
              position: 'absolute', top: '20px', left: '20px',
              color: '#22c55e', fontWeight: 900, fontSize: '22px',
              border: '3px solid #22c55e', padding: '4px 12px',
              borderRadius: '8px', transform: 'rotate(-15deg)',
            }}>CHAT ✅</div>
          )}
          {pos.x < -60 && (
            <div style={{
              position: 'absolute', top: '20px', right: '20px',
              color: '#ef4444', fontWeight: 900, fontSize: '22px',
              border: '3px solid #ef4444', padding: '4px 12px',
              borderRadius: '8px', transform: 'rotate(15deg)',
            }}>SKIP ❌</div>
          )}

          {/* Avatar */}
          <div style={{
            width: '90px', height: '90px',
            background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '36px', fontWeight: 700,
            margin: '0 auto 16px', overflow: 'hidden',
          }}>
            {current.photo
              ? <img src={current.photo} alt={current.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              : current.name?.charAt(0).toUpperCase()
            }
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>{current.name}</h2>
          <span className="user-level">{current.level || 'English Speaker'}</span>

          {current.bio && (
            <p style={{ color: '#aaa', fontSize: '14px', marginTop: '12px', lineHeight: 1.5 }}>
              {current.bio}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '12px', color: '#7c6ff7' }}>📞 {current.callCount || 0} calls</span>
            <span style={{ fontSize: '12px', color: '#7c6ff7' }}>🕐 {current.totalMinutes || 0} min</span>
            {current.streak > 0 && <span style={{ fontSize: '12px', color: '#f59e0b' }}>🔥 {current.streak}</span>}
          </div>

          <div style={{ marginTop: '8px' }}>
            <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>🟢 Online</span>
          </div>
        </div>

        {/* Hint */}
        <p style={{ color: '#555', fontSize: '13px', marginTop: '20px' }}>
          👉 Sağa sürüşdür — Chat & Call
        </p>
        <p style={{ color: '#555', fontSize: '13px' }}>
          👈 Sola sürüşdür — Keç
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
          <button
            onClick={() => setCurrentIndex(prev => prev + 1)}
            style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#1e1e30', border: '2px solid #ef4444',
              fontSize: '28px', cursor: 'pointer',
            }}
          >❌</button>
          <button
            onClick={() => navigate(`/chat/${current.uid}`)}
            style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none', fontSize: '28px', cursor: 'pointer',
            }}
          >✅</button>
        </div>
      </div>
    </div>
  );
}