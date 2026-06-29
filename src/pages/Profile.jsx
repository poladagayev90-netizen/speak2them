import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
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


  const [isEditing, setIsEditing] = useState(false);

  const avgRating = stats.ratingCount > 0 ? (stats.rating / stats.ratingCount).toFixed(1) : '—';

  // Calculate Minute Balance
  let displayedBalance = 15 + bonusMinutes;
  let balanceLabel = `15 min limit + ${bonusMinutes} bonus / call`;
  if (isPremium && user.premiumPlan !== 'unlimited') {
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    let monthlyLimit = user.premiumPlan === 'basic' ? 120 : (user.premiumPlan === 'pro' ? 500 : 0);
    const currentMonthMinutes = user.currentMonth === currentMonthStr ? (user.currentMonthMinutes || 0) : 0;
    const remainingMonthlyMinutes = Math.max(0, monthlyLimit - currentMonthMinutes);
    displayedBalance = remainingMonthlyMinutes + bonusMinutes;
    balanceLabel = `${remainingMonthlyMinutes} plan + ${bonusMinutes} bonus`;
  } else if (isPremium && user.premiumPlan === 'unlimited') {
    displayedBalance = '∞';
    balanceLabel = `Unlimited plan active`;
  }

  if (isEditing) {
    return (
      <div className="profile-page" style={{ backgroundColor: '#0f0f0f', minHeight: '100%', padding: '16px', paddingBottom: '90px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '16px', cursor: 'pointer' }}>Cancel</button>
          <h2 style={{ fontSize: '18px', margin: 0, color: '#fff' }}>Edit Profile</h2>
          <button onClick={() => { handleSave(); setIsEditing(false); }} style={{ background: 'none', border: 'none', color: '#7c6ff7', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
            {saved ? 'Saved' : loading ? '...' : 'Save'}
          </button>
        </div>
        <div className="profile-form" style={{ background: '#1e1e30', padding: '20px', borderRadius: '16px' }}>
          <label style={{ color: '#a1a1aa', fontSize: '12px' }}>Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ background: '#151520', border: 'none', color: '#fff', padding: '12px', borderRadius: '8px', width: '100%', marginBottom: '16px' }} />
          
          <label style={{ color: '#a1a1aa', fontSize: '12px' }}>English Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)} style={{ background: '#151520', border: 'none', color: '#fff', padding: '12px', borderRadius: '8px', width: '100%', marginBottom: '16px' }}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          
          <label style={{ color: '#a1a1aa', fontSize: '12px' }}>Bio Status</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell others about yourself..." rows={3} style={{ background: '#151520', border: 'none', color: '#fff', padding: '12px', borderRadius: '8px', width: '100%' }} />
        </div>
      </div>
    );
  }

  const handleSettingsClick = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      handleLogout();
    }
  };

  return (
    <div className="profile-page" style={{ backgroundColor: '#0f0f0f', minHeight: '100%', padding: '16px', paddingBottom: '90px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '16px', cursor: 'pointer' }}>Edit</button>
        <button onClick={handleSettingsClick} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>⚙️</button>
      </div>

      {/* TOP SECTION: AVATAR, NAME, STATS */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        
        {/* Fake Topic Bubble */}
        <div style={{ display: 'inline-block', background: '#2e2e50', color: '#a1a1aa', fontSize: '12px', padding: '6px 12px', borderRadius: '20px', marginBottom: '12px', position: 'relative' }}>
          Set a topic...
          <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #2e2e50' }}></div>
        </div>

        {/* Avatar */}
        <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 16px' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #3a3a5a, #1e1e30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            {name?.charAt(0).toUpperCase() || '?'}
          </div>
          {/* Online Flag Indicator */}
          <div style={{ position: 'absolute', bottom: '0', right: '0', width: '22px', height: '22px', borderRadius: '50%', background: '#10b981', border: '3px solid #0f0f0f' }}></div>
        </div>

        {/* Name & Bio */}
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 4px 0' }}>{name || 'User'}</h2>
        <p style={{ fontSize: '14px', color: '#a1a1aa', margin: '0 0 24px 0' }}>{bio || 'No time to die'}</p>

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e1e30', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#2e2e50', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💎</div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '2px' }}>Current Plan</div>
            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
              {isPremium ? (user.premiumPlan ? user.premiumPlan.charAt(0).toUpperCase() + user.premiumPlan.slice(1) : 'Pro') : 'Free Plan'}
            </div>
          </div>
        </div>
        {!isPremium && (
          <button onClick={() => navigate('/upgrade')} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#1a1000', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Upgrade</button>
        )}
      </div>

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

        {/* Email */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #2e2e50' }}>
          <div style={{ background: '#10b98122', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginRight: '16px' }}>✉️</div>
          <div>
            <div style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '2px' }}>Email Address</div>
            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{user.email || 'Hidden'}</div>
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

      {/* MINUTE BALANCE (Gifts Alternative) */}
      <div style={{ background: '#1e1e30', borderRadius: '16px', padding: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>Minute Balance</h3>
          <p style={{ color: '#a1a1aa', fontSize: '12px', margin: 0 }}>{balanceLabel}</p>
        </div>
        <div style={{ background: '#7c6ff722', padding: '8px 16px', borderRadius: '20px', color: '#7c6ff7', fontWeight: 700, fontSize: '16px' }}>
          {displayedBalance}
        </div>
      </div>

    </div>
  );
}