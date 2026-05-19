import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const LEVELS = ['A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

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
          const q = query(collection(db, 'users'), where('email', '==', email));
          const snap = await getDocs(q);
          if (!snap.empty) foundDocId = snap.docs[0].id;
        }

        if (!foundDocId) {
          const q2 = query(collection(db, 'users'), where('uid', '==', user.uid));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) foundDocId = snap2.docs[0].id;
        }

        if (foundDocId) {
          setDocId(foundDocId);
          unsub = onSnapshot(doc(db, 'users', foundDocId), (snap) => {
            if (snap.exists()) {
              const userData = snap.data();
              setName(userData.name || '');
              setBio(userData.bio || '');
              setLevel(userData.level || 'B1 – Intermediate');
              setIsPremium(userData.isPremium || false);
              setStats({
                calls: userData.callCount || 0,
                totalMinutes: userData.totalMinutes || 0,
                streak: userData.streak || 0,
              });
            }
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    setup();
    return () => unsub?.();
  }, [user]);

  const handleSave = async () => {
    if (!docId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', docId), { name, bio, level });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
        <h2>My Profile</h2>
      </div>

      <div className="profile-body">

        <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto 8px' }}>
          <div className="profile-avatar-big">
            {name?.charAt(0).toUpperCase() || '?'}
          </div>
          {isPremium && (
            <div style={{
              position: 'absolute', bottom: '-4px', right: '-4px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderRadius: '50%', width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', boxShadow: '0 0 10px #f59e0b88',
            }}>👑</div>
          )}
        </div>

        {isPremium && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', marginBottom: '16px',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#1a1000', fontSize: '12px', fontWeight: 700,
              padding: '4px 14px', borderRadius: '20px',
              boxShadow: '0 0 12px #f59e0b55',
            }}>✨ Premium Member</span>
          </div>
        )}

        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-number">{stats.calls}</span>
            <span className="stat-label">📞 Calls</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalMinutes}</span>
            <span className="stat-label">🕐 Minutes</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.streak}</span>
            <span className="stat-label">🔥 Streak</span>
          </div>
        </div>

        <div className="profile-form">
          <label>Full Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
          />

          <label>English Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>

          <label>Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell others about yourself..."
            rows={3}
          />

          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            {saved ? '✅ Saved!' : loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}