import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { BadgeGrid } from '../components/BadgeSystem';

const LEVELS = ['A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Profile({ user }) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [level, setLevel] = useState('B1 – Intermediate');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [badges, setBadges] = useState([]);
  const [stats, setStats] = useState({ calls: 0, totalMinutes: 0, streak: 0, rating: 0, ratingCount: 0 });
  const [bonusMinutes, setBonusMinutes] = useState(0);
  const [docId, setDocId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let unsub = null;
    const setup = async () => {
      try {
        const email = user.email || auth.currentUser?.email;
        let foundDocId = null;
        if (email) {
          const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
          if (!snap.empty) foundDocId = snap.docs[0].id;
        }
        if (!foundDocId) {
          const snap2 = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
          if (!snap2.empty) foundDocId = snap2.docs[0].id;
        }
        if (foundDocId) {
          setDocId(foundDocId);
          unsub = onSnapshot(doc(db, 'users', foundDocId), (snap) => {
            if (snap.exists()) {
              const d = snap.data();
              setName(d.name || '');
              setBio(d.bio || '');
              setLevel(d.level || 'B1 – Intermediate');
              setIsPremium(d.isPremium || false);
              setBadges(d.badges || []);
              setStats({ calls: d.callCount || 0, totalMinutes: d.totalMinutes || 0, streak: d.streak || 0, rating: d.rating || 0, ratingCount: d.ratingCount || 0 });
              setBonusMinutes(d.bonusMinutes || 0);
            }
          });
        }
      } catch (e) { console.error(e); }
    };
    setup();
    return () => unsub?.();
  }, [user]);

  const handleSave = async () => {
    if (!docId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', docId), { name, bio, level });
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  let pushMessage = "💪 Make your first call today!";
  if (stats.streak >= 7) {
    pushMessage = `🔥 ${stats.streak} day streak! You're on fire!`;
  } else if (stats.calls >= 10) {
    pushMessage = `📞 ${stats.calls} calls done. Keep it up!`;
  } else if (stats.totalMinutes >= 60) {
    pushMessage = `🕐 ${stats.totalMinutes} min spoken. Amazing!`;
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>My Profile</h2>
        <button onClick={handleLogout} style={{
          background: 'transparent', border: '1px solid #ff4d4d55',
          color: '#ff6b6b', padding: '6px 14px', borderRadius: '8px',
          cursor: 'pointer', fontSize: '13px', fontWeight: 600,
        }}>Logout</button>
      </div>

      <div className="profile-body" style={{ paddingBottom: '90px' }}>
        
        {/* TASK 1: PLAN INDICATOR */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div className="profile-avatar-big" style={{ margin: '0 auto 8px' }}>
            {name?.charAt(0).toUpperCase() || '?'}
          </div>
          {isPremium ? (
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#1a1000', fontSize: '12px', fontWeight: 700,
              padding: '4px 14px', borderRadius: '20px',
              boxShadow: '0 0 12px #f59e0b55'
            }}>⭐ Pro Member</span>
          ) : (
            <span style={{
              background: '#2a2a3b', color: '#a1a1aa',
              fontSize: '12px', fontWeight: 600,
              padding: '4px 14px', borderRadius: '20px',
            }}>Free Plan</span>
          )}
        </div>

        {/* TASK 3: MOTIVATIONAL PUSH MESSAGE */}
        <div style={{
          background: '#1e1e30', borderLeft: '3px solid #7c6ff7',
          padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
          fontSize: '14px', fontWeight: 600, color: '#e2e8f0'
        }}>
          {pushMessage}
        </div>

        {/* TASK 6: STATS SECTION CLEANUP */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px'
        }}>
          <div style={{ background: '#1e1e30', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{stats.calls}</div>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>📞 Calls</div>
          </div>
          <div style={{ background: '#1e1e30', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{stats.totalMinutes}</div>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>🕐 Min</div>
          </div>
          <div style={{ background: '#1e1e30', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{stats.streak}</div>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>🔥 Streak days</div>
          </div>
          <div style={{ background: '#1e1e30', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
              {stats.ratingCount > 0 ? (stats.rating / stats.ratingCount).toFixed(1) : '—'}
            </div>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>⭐ Rating</div>
          </div>
        </div>

        {/* TASK 4: MINUTE BALANCE DISPLAY */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1e30, #251e3f)',
          border: '1px solid #7c6ff744', borderRadius: '12px', padding: '16px',
          marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '13px', color: '#fde68a', fontWeight: 700, marginBottom: '2px' }}>⚡ Minute Balance</div>
            <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
              {bonusMinutes > 0 ? "Earned from badges & rewards" : "Earn minutes by unlocking badges"}
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', textShadow: '0 0 10px rgba(124, 111, 247, 0.3)' }}>
            {bonusMinutes}
          </div>
        </div>

        {/* TASK 2: PRO UPGRADE BUTTON */}
        {!isPremium && (
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <button
              onClick={() => navigate('/upgrade')}
              style={{
                width: '100%', height: '52px', borderRadius: '26px', border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #ff6b35)',
                color: '#fff', fontSize: '16px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                animation: 'pulse-glow 2s infinite',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              ⭐ Upgrade to Pro
            </button>
            <style>
              {`
                @keyframes pulse-glow {
                  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                  70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
                  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
              `}
            </style>
            <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '8px' }}>
              Unlimited calls · AI feedback · Priority matching
            </div>
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <BadgeGrid earnedBadges={badges} />
        </div>

        <div className="profile-form">
          <label>Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          <label>English Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          <label>Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell others about yourself..." rows={3} />
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            {saved ? '✅ Saved!' : loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}