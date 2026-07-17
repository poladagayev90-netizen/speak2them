import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { blockUser, unblockUser, submitReport } from '../utils/blocklist';

export default function UserProfile({ user: currentUser }) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!uid || !currentUser?.uid || uid === currentUser.uid) return undefined;
    return onSnapshot(
      doc(db, 'users', currentUser.uid, 'blocked', uid),
      (snap) => setIsBlocked(snap.exists()),
      () => {}
    );
  }, [uid, currentUser?.uid]);

  const handleBlockToggle = async () => {
    try {
      if (isBlocked) {
        await unblockUser(currentUser.uid, uid);
      } else {
        if (!window.confirm('Bu istifadəçini bloklayırsınız? Onu siyahılarda görməyəcək, zəng və mesajlarını almayacaqsınız.')) return;
        await blockUser(currentUser.uid, uid, profileUser?.name);
      }
    } catch (e) { console.error('[UserProfile] block', e); }
  };

  const handleReport = async () => {
    const reason = window.prompt('Şikayət səbəbini qısaca yazın (təhqir, spam, uyğunsuz davranış və s.):');
    if (reason === null) return;
    try {
      await submitReport(currentUser.uid, uid, profileUser?.name, reason);
      setReported(true);
      alert('Şikayətiniz göndərildi — komandamız baxacaq. Təşəkkürlər.');
    } catch (e) {
      console.error('[UserProfile] report', e);
      alert('Göndərilmədi, yenidən cəhd edin.');
    }
  };

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
      <div className="profile-page" style={{ backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading profile...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="profile-page" style={{ backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>User not found.</p>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Go Back</button>
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
    <div className="profile-page" style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', paddingBottom: '120px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '16px', cursor: 'pointer' }}>← Back</button>
      </div>

      {/* TOP SECTION: AVATAR, NAME, STATS */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        
        {/* Avatar */}
        <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 16px' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            {name.charAt(0).toUpperCase()}
          </div>
          {/* Online Flag Indicator */}
          {isOnline && (
            <div style={{ position: 'absolute', bottom: '0', right: '0', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--success)', border: '3px solid var(--bg-primary)' }}></div>
          )}
        </div>

        {/* Name & Bio */}
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{name}</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>{bio}</p>

        {/* Action Buttons */}
        {uid !== currentUser.uid && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {!isBlocked && (
              <button
                onClick={() => navigate(`/chat/${uid}`)}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '10px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                💬 Chat
              </button>
            )}
            <button
              onClick={handleBlockToggle}
              style={{ background: 'none', border: '1px solid var(--border)', color: isBlocked ? 'var(--text-secondary)' : '#ef4444', padding: '10px 18px', borderRadius: '24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              {isBlocked ? '✓ Blokdan çıxar' : '🚫 Blokla'}
            </button>
            <button
              onClick={reported ? undefined : handleReport}
              disabled={reported}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '10px 18px', borderRadius: '24px', fontSize: '14px', fontWeight: 600, cursor: reported ? 'default' : 'pointer', opacity: reported ? 0.6 : 1 }}
            >
              {reported ? '✓ Şikayət göndərildi' : '⚠️ Şikayət et'}
            </button>
          </div>
        )}

        {/* Horizontal Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', borderBottom: '1px solid var(--border)', paddingBottom: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>
              <span>💬</span> Feedback
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{avgRating}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>
              <span>📞</span> Talks
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.calls}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>
              <span>🕐</span> Mins
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalMinutes}</div>
          </div>
        </div>
      </div>

      {/* PLAN INDICATOR */}
      {isPremium && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--bg-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💎</div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '2px' }}>Current Plan</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>
                {premiumPlan.charAt(0).toUpperCase() + premiumPlan.slice(1)} Member
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INFORMATION SECTION */}
      <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, margin: '24px 0 16px 0' }}>Information</h3>
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '8px 0' }}>
        
        {/* Level */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: 'var(--accent-soft)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginRight: '16px' }}>💬</div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '2px' }}>English level</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>{level}</div>
          </div>
        </div>

        {/* Streak */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
          <div style={{ background: '#f59e0b22', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginRight: '16px' }}>🔥</div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '2px' }}>Current Streak</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>{stats.streak} Days</div>
          </div>
        </div>
      </div>
    </div>
  );
}