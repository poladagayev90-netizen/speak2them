import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';

export default function UserProfile({ user: currentUser }) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        setProfileUser({ uid: snap.id, ...snap.data() });
      } else {
        setProfileUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  if (loading) {
    return (
      <div className="profile-page" style={{ backgroundColor: '#0f0f0f', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a1a1aa' }}>Loading profile...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="profile-page" style={{ backgroundColor: '#0f0f0f', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a1a1aa', marginBottom: '16px' }}>User not found.</p>
        <button onClick={() => navigate(-1)} style={{ background: '#2e2e50', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Go Back</button>
      </div>
    );
  }

  const name = profileUser.name || 'User';
  const bio = profileUser.bio || 'No bio provided';
  const level = profileUser.level || 'B1 – Intermediate';
  const isPremium = profileUser.isPremium || false;
  const premiumPlan = profileUser.premiumPlan || 'Pro';
  
  const stats = {
    calls: profileUser.callCount || 0,
    totalMinutes: profileUser.totalMinutes || 0,
    streak: profileUser.streak || 0,
    rating: profileUser.rating || 0,
    ratingCount: profileUser.ratingCount || 0
  };
  
  const avgRating = stats.ratingCount > 0 ? (stats.rating / stats.ratingCount).toFixed(1) : '—';
  const isOnline = profileUser.online;

  return (
    <div className="profile-page" style={{ backgroundColor: '#0f0f0f', minHeight: '100%', padding: '16px', paddingBottom: '90px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '16px', cursor: 'pointer' }}>← Back</button>
      </div>

      {/* TOP SECTION: AVATAR, NAME, STATS */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        
        {/* Avatar */}
        <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 16px' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #3a3a5a, #1e1e30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            {name.charAt(0).toUpperCase()}
          </div>
          {/* Online Flag Indicator */}
          {isOnline && (
            <div style={{ position: 'absolute', bottom: '0', right: '0', width: '22px', height: '22px', borderRadius: '50%', background: '#10b981', border: '3px solid #0f0f0f' }}></div>
          )}
        </div>

        {/* Name & Bio */}
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 4px 0' }}>{name}</h2>
        <p style={{ fontSize: '14px', color: '#a1a1aa', margin: '0 0 24px 0' }}>{bio}</p>

        {/* Action Buttons */}
        {uid !== currentUser.uid && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
            <button 
              onClick={() => navigate(`/chat/${uid}`)} 
              style={{ background: '#2e2e50', border: '1px solid #3a3a5a', color: '#fff', padding: '10px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              💬 Chat
            </button>
            <button 
              onClick={() => navigate(`/chat/${uid}`)} 
              style={{ background: 'linear-gradient(135deg, #7c6ff7, #5a4bdf)', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(124, 111, 247, 0.4)' }}
            >
              📞 Call
            </button>
          </div>
        )}

        {/* Horizontal Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', borderBottom: '1px solid #1e1e30', paddingBottom: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}>
              <span>💬</span> Feedback
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{avgRating}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}>
              <span>📞</span> Talks
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{stats.calls}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}>
              <span>🕐</span> Mins
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{stats.totalMinutes}</div>
          </div>
        </div>
      </div>

      {/* PLAN INDICATOR */}
      {isPremium && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e1e30', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#2e2e50', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💎</div>
            <div>
              <div style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '2px' }}>Current Plan</div>
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                {premiumPlan.charAt(0).toUpperCase() + premiumPlan.slice(1)} Member
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INFORMATION SECTION */}
      <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: '24px 0 16px 0' }}>Information</h3>
      <div style={{ background: '#1e1e30', borderRadius: '16px', padding: '8px 0' }}>
        
        {/* Level */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #2e2e50' }}>
          <div style={{ background: '#7c6ff722', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginRight: '16px' }}>💬</div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '2px' }}>English level</div>
            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{level}</div>
          </div>
        </div>

        {/* Streak */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
          <div style={{ background: '#f59e0b22', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginRight: '16px' }}>🔥</div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '2px' }}>Current Streak</div>
            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{stats.streak} Days</div>
          </div>
        </div>
      </div>
    </div>
  );
}