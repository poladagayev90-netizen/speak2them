import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const LEVELS = ['A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Profile({ user }) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ calls: 0, rating: 0, ratingCount: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(d => {
      if (d.exists()) {
        const data = d.data();
        setName(data.name || '');
        setBio(data.bio || '');
        setLevel(data.level || 'B1 – Intermediate');
        setStats({
          calls: data.callCount || 0,
          rating: data.rating || 0,
          ratingCount: data.ratingCount || 0,
        });
      }
    });
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { name, bio, level });
      await updateProfile(auth.currentUser, { displayName: name });
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
          {name?.charAt(0).toUpperCase()}
        </div>

        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-number">{stats.calls}</span>
            <span className="stat-label">Calls</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {stats.ratingCount > 0 ? (stats.rating / stats.ratingCount).toFixed(1) : '—'}
            </span>
            <span className="stat-label">Rating ⭐</span>
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