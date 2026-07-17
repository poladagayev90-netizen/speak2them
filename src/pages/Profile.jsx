import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { db, auth, enableNotifications } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Bell } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import WordHistoryPanel from '../components/WordHistoryPanel';
import StreakJourney from '../components/StreakJourney';
import { getStreakInfo } from '../utils/streak';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { isNativePush, getNativePushPermission, enableNativePush } from '../nativePush';


const LEVELS = ['A1 – Beginner', 'A2 – Elementary', 'B1 – Intermediate',
                'B2 – Upper-Intermediate', 'C1 – Advanced', 'C2 – Proficient'];

export default function Profile({ user }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [level, setLevel] = useState('B1 – Intermediate');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [mode, setMode] = useState(user.mode || '');
  const [stats, setStats] = useState({ calls: 0, totalMinutes: 0, streak: 0, rating: 0, ratingCount: 0 });
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [streakInfo, setStreakInfo] = useState({ count: 0, alive: false, doneToday: false });
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
              setMode(d.mode || '');
              setStats({ calls: d.callCount || 0, totalMinutes: d.totalMinutes || 0, streak: d.streak || 0, rating: d.rating || 0, ratingCount: d.ratingCount || 0 });
              setStreakInfo(getStreakInfo(d));
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

  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    // Two-step confirmation: an explicit warning, then a typed word, so the
    // account can never be destroyed by a single accidental tap.
    if (!window.confirm(
      'Hesabınız və bütün datanız (profil, söz tarixçəsi, zəng analizləri, səs qeydləri) həmişəlik silinəcək. Bu əməliyyat geri qaytarıla bilməz. Davam edilsin?'
    )) return;
    const typed = window.prompt('Təsdiq üçün "SİL" yazın:');
    if ((typed || '').trim().toUpperCase() !== 'SİL') return;

    setDeleting(true);
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/deleteAccount`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Silinmə uğursuz oldu');
      }
      await signOut(auth).catch(() => {});
      alert('Hesabınız silindi.');
      navigate('/login');
    } catch (e) {
      console.error(e);
      alert(e.message || 'Silinmə zamanı xəta baş verdi. Yenidən cəhd edin.');
      setDeleting(false);
    }
  };


  const [isEditing, setIsEditing] = useState(false);
  const [showWordHistory, setShowWordHistory] = useState(false);
  // Native reports permission asynchronously through the plugin; on web it is
  // readable synchronously. Starting native at 'default' keeps the row tappable
  // until the real state arrives a tick later.
  const [notifPerm, setNotifPerm] = useState(
    isNativePush() ? 'default' : (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  );

  useEffect(() => {
    if (!isNativePush()) return;
    let cancelled = false;
    getNativePushPermission().then((p) => { if (!cancelled) setNotifPerm(p); });
    return () => { cancelled = true; };
  }, []);

  const handleEnableNotifications = async () => {
    if (notifPerm !== 'default') return; // granted or denied: system settings only now
    const status = isNativePush()
      ? await enableNativePush(user.uid)
      : await enableNotifications(user.uid);
    setNotifPerm(status);
  };

  const notifLabel = {
    granted: 'Aktiv',
    denied: isNativePush() ? 'Cihaz parametrlərindən aç' : 'Brauzer parametrlərindən aç',
    default: 'Aktivləşdir',
    unsupported: 'Bu cihazda mövcud deyil',
  }[notifPerm] || 'Aktivləşdir';

  const avgRating = stats.ratingCount > 0 ? (stats.rating / stats.ratingCount).toFixed(1) : '—';

  if (isEditing) {
    return (
      <div className="profile-page" style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', paddingBottom: '120px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '16px', cursor: 'pointer' }}>Cancel</button>
          <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--text-primary)' }}>Edit Profile</h2>
          <button onClick={() => { handleSave(); setIsEditing(false); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
            {saved ? 'Saved' : loading ? '...' : 'Save'}
          </button>
        </div>
        <div className="profile-form" style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', width: '100%', marginBottom: '16px' }} />
          
          <label style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>English Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)} style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', width: '100%', marginBottom: '16px' }}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          
          <label style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Bio Status</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell others about yourself..." rows={3} style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', width: '100%' }} />
        </div>
      </div>
    );
  }

  // Compact iOS-style list building blocks, shared by every settings group below
  // so the profile reads as one grouped list instead of a stack of loose cards.
  const divider = '1px solid var(--border)';
  const listCard = { background: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' };
  const sectionLabel = (t) => (
    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 6px 8px' }}>{t}</div>
  );
  const row = ({ icon, label, value, right, onClick, danger, notLast }) => (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', cursor: onClick ? 'pointer' : 'default', borderBottom: notLast ? divider : 'none' }}
    >
      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: danger ? '#ef444422' : 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '17px', color: danger ? '#ef4444' : 'var(--accent)' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: danger ? '#ef4444' : 'var(--text-primary)', fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        {value && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>}
      </div>
      {right !== undefined ? right : (onClick ? <span style={{ color: 'var(--text-secondary)', fontSize: '18px', flexShrink: 0 }}>›</span> : null)}
    </div>
  );

  return (
    <div className="profile-page" style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', paddingBottom: '120px' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '8px' }}>
        <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>Redaktə et</button>
      </div>

      {/* TOP SECTION: AVATAR, NAME, STATS */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        
        {/* Avatar */}
        <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 16px' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            {name?.charAt(0).toUpperCase() || '?'}
          </div>
          {/* Online Flag Indicator */}
          <div style={{ position: 'absolute', bottom: '0', right: '0', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--success)', border: '3px solid var(--bg-primary)' }}></div>
        </div>

        {/* Name & Bio */}
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{name || 'User'}</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>{bio || 'No time to die'}</p>

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

      {/* PLAN — satış yoxdur: yeni user hər şeyi açıq görür, yalnız burada
          "Sınaq dövrü" yazılır. Kohortdan keçən avtomatik Kurs/Pro olur. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
        <div style={{ background: 'var(--bg-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
          {mode === 'course' ? '🎓' : isPremium ? '💎' : '⏳'}
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '2px' }}>Plan</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>
            {mode === 'course' ? 'Kurs iştirakçısı'
              : isPremium ? 'Pro'
              : user.cohortStatus === 'accepted' ? 'Kohort — qəbul edildi'
              : user.cohortStatus === 'pending' ? 'Kohort — müraciət gözləyir'
              : 'Sınaq dövrü'}
          </div>
        </div>
      </div>

      {/* COURSE CODE — kodla kohorta müraciət yolu; artıq kursda olan və ya
          müraciəti gözləyən user üçün görünmür. */}
      {mode !== 'course' && !user.cohortStatus && (
        <button
          onClick={() => navigate('/redeem')}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
            border: '1px solid #7c6ff755', color: 'var(--text-primary)',
            padding: '16px', borderRadius: '16px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '12px',
            cursor: 'pointer', fontSize: '16px', fontWeight: 700, textAlign: 'left',
          }}
        >
          🎟️ Kodunuz var? Kohorta müraciət edin
        </button>
      )}

      {/* ÖYRƏNMƏ */}
      {sectionLabel('Öyrənmə')}
      <div style={listCard}>
        {row({ icon: '📚', label: 'Mənim Sözlərim', onClick: () => setShowWordHistory(true), notLast: true })}
        {row({ icon: '🔥', label: 'Streak Səyahəti', onClick: () => setJourneyOpen(true), right: <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '15px', flexShrink: 0 }}>{streakInfo.count}</span>, notLast: true })}
        {row({ icon: '📊', label: 'Analiz Tarixçəsi', onClick: () => navigate('/history') })}
      </div>

      {/* MƏLUMAT */}
      {sectionLabel('Məlumat')}
      <div style={listCard}>
        {row({ icon: '💬', label: 'İngilis səviyyəsi', right: <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>{level}</span>, notLast: true })}
        {row({ icon: '✉️', label: user.email || 'Hidden', value: 'Email' })}
      </div>

      {/* TƏNZİMLƏMƏLƏR */}
      {sectionLabel('Tənzimləmələr')}
      <div style={listCard}>
        {row({
          icon: isDark ? <Moon size={17} /> : <Sun size={17} />,
          label: isDark ? 'Qaranlıq rejim' : 'İşıqlı rejim',
          onClick: toggleTheme,
          right: <span className={`theme-switch ${isDark ? 'dark' : 'light'}`} aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0 }}><span className="theme-switch-thumb"></span></span>,
          notLast: true,
        })}
        {row({
          icon: <Bell size={17} />,
          label: 'Push bildirişləri',
          onClick: handleEnableNotifications,
          right: <span style={{ fontSize: '13px', fontWeight: 700, flexShrink: 0, color: notifPerm === 'granted' ? 'var(--success)' : 'var(--accent)' }}>{notifLabel}</span>,
          notLast: true,
        })}
        {row({
          icon: '🔄',
          label: 'Turları sıfırla',
          onClick: async () => {
            if (!docId) return;
            try {
              await updateDoc(doc(db, 'users', docId), { tourDone_home: false, tourDone_chat: false, tourDone_profile: false });
              alert('Turlar sıfırlandı! Səhifələri gəzərək yenidən baxa bilərsiniz.');
            } catch (e) { console.error(e); }
          },
        })}
      </div>

      {/* HESAB — Google Play requires an in-app privacy link and a way to
          delete the account together with its data. */}
      {sectionLabel('Hesab')}
      <div style={listCard}>
        {row({ icon: '🔒', label: 'Məxfilik Siyasəti', onClick: () => window.open('/privacy.html', '_blank'), notLast: true })}
        {row({ icon: '🗑️', label: deleting ? 'Silinir…' : 'Hesabı Sil', onClick: deleting ? undefined : handleDeleteAccount, danger: true, right: null, notLast: true })}
        {row({ icon: '↩️', label: 'Çıxış', onClick: () => { if (window.confirm('Çıxış etmək istəyirsiniz?')) handleLogout(); }, right: null })}
      </div>

      {showWordHistory && (
        <WordHistoryPanel userId={user.uid} onClose={() => setShowWordHistory(false)} />
      )}

      <StreakJourney open={journeyOpen} streakInfo={streakInfo} onClose={() => setJourneyOpen(false)} />

    </div>
  );
}