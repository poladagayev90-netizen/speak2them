import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
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
  const [stats, setStats] = useState({ calls: 0, totalMinutes: 0, streak: 0 });
  const [docId, setDocId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const email = user.email || auth.currentUser?.email;
        let userData = null;
        let foundDocId = null;

        if (email) {
          const q = query(collection(db, 'users'), where('email', '==', email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            userData = snap.docs[0].data();
            foundDocId = snap.docs[0].id;
          }
        }

        if (!userData) {
          const q2 = query(collection(db, 'users'), where('uid', '==', user.uid));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            userData = snap2.docs[0].data();
            foundDocId = snap2.docs[0].id;
          }
        }

        if (userData) {
          setName(userData.name || '');
          setBio(userData.bio || '');
          setLevel(userData.level || 'B1 – Intermediate');
          setStats({
            calls: userData.callCount || 0,
            totalMinutes: userData.totalMinutes || 0,
            streak: userData.streak || 0,
          });
          setDocId(foundDocId);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchProfile();
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
        <div className="profile-avatar-big">
          {name?.charAt(0).toUpperCase() || '?'}
        </div>

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