import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const LEVELS = ['A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

                import { BadgeGrid } from '../components/BadgeSystem';
// profile body-də:
<BadgeGrid earnedBadges={userData.badges || []} />
export default function Profile({ user }) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [level, setLevel] = useState('B1 – Intermediate');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [stats, setStats] = useState({ calls: 0, totalMinutes: 0, streak: 0 });
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
              setStats({ calls: d.callCount || 0, totalMinutes: d.totalMinutes || 0, streak: d.streak || 0 });
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
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div className="profile-avatar-big" style={{ margin: '0 auto 8px' }}>
            {name?.charAt(0).toUpperCase() || '?'}
          </div>
          {isPremium && (
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#1a1000', fontSize: '12px', fontWeight: 700,
              padding: '4px 14px', borderRadius: '20px',
            }}>✨ Premium Member</span>
          )}
        </div>

        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-number">{stats.calls}</span>
            <span className="stat-label">📞 Calls</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalMinutes}</span>
            <span className="stat-label">🕐 Min</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.streak}</span>
            <span className="stat-label">🔥 Streak</span>
          </div>
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