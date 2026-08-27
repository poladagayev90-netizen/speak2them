import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { db, auth, enableNotifications } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Moon, Sun, Bell, Volume2, VolumeX, BookMarked, Flame, BarChart3,
  GraduationCap, Shield, Trash2, LogOut, Pencil, ChevronRight, Signal, Mail, RotateCcw, Trophy,
  LineChart,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Stat from '../components/ui/Stat';
import { sfxEnabled, setSfxEnabled, sfxPop } from '../utils/sfx';
import { useTheme } from '../context/ThemeContext';
import WordHistoryPanel from '../components/WordHistoryPanel';
import StreakJourney from '../components/StreakJourney';
import TutorBadge from '../components/TutorBadge';
import { getStreakInfo } from '../utils/streak';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { isNativePush, getNativePushPermission, enableNativePush } from '../nativePush';
import { FEEDBACK_LANGUAGES, setFeedbackLanguage, getFeedbackLanguage } from '../utils/feedbackLanguage';
import { isAdminUser } from '../utils/courseProgress';


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
  const [feedbackLang, setFeedbackLang] = useState(getFeedbackLanguage);
  const navigate = useNavigate();

  // Dil dəyişimi: dərhal UI + localStorage (i18n modulu), sonra Firestore-a
  // yazılır ki, digər cihazlarda da tətbiq olunsun. Firestore yazısı uğursuz
  // olsa belə lokal seçim qalır — dil dəyişmək heç vaxt "uğursuz" görünməsin.
  const changeLanguage = async (code) => {
    if (code === feedbackLang) return;
    setFeedbackLang(setFeedbackLanguage(code));
    try {
      const targetId = docId || user.uid;
      // appLanguage birlikdə yazılır: seçim həm hesabatın dilidir, həm də
      // bildirişlərin. Ayrı-ayrı yazılsaydı, dili dəyişən istifadəçi növbəti
      // girişə qədər köhnə dildə push almağa davam edərdi.
      if (targetId) {
        await updateDoc(doc(db, 'users', targetId), {
          preferredLanguage: code,
          appLanguage: code,
        });
      }
    } catch (e) {
      console.warn('[Profile] preferredLanguage save failed:', e.message);
    }
  };

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
    // İki addımlı təsdiq — YAZMA tələbi YOXDUR.
    //
    // Əvvəl istifadəçidən "SİL" yazmaq istənilirdi və yoxlama belə idi:
    //     typed.toUpperCase() !== 'SİL'
    // JS-in default toUpperCase() metodu 'i' hərfini NÖQTƏSİZ 'I'-ya çevirir,
    // yəni "sil" → "SIL" ≠ "SİL". Nəticədə şərt heç vaxt ödənmirdi və hesab
    // silinmirdi. İki ayrı təsdiq təsadüfi toxunuşdan qorunmaq üçün kifayətdir.
    if (!window.confirm(
      'Your account and all of your data (profile, word history, call analyses, recordings) will be permanently deleted. This cannot be undone. Continue?'
    )) return;
    if (!window.confirm(
      'Final confirmation: delete your account permanently now?'
    )) return;

    setDeleting(true);
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/deleteAccount`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Deletion failed');
      }
      await signOut(auth).catch(() => {});
      alert('Your account has been deleted.');
      navigate('/login');
    } catch (e) {
      console.error(e);
      alert(e.message || 'Something went wrong during deletion. Please try again.');
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
  const [sfx, setSfx] = useState(() => sfxEnabled());

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
    denied: isNativePush() ? 'Open device settings' : 'Open browser settings',
    default: 'Activate',
    unsupported: 'Not available on this device',
  }[notifPerm] || 'Activate';

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
          <label style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', width: '100%', marginBottom: '16px' }} />
          
          <label style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>English Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)} style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', width: '100%', marginBottom: '16px' }}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          
          <label style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Bio Status</label>
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
  // A lucide component, a ready-made element, or (legacy) an emoji string.
  // Order matters: an element is also an object, and a lucide icon is a
  // forwardRef OBJECT rather than a function -- checking for a function first
  // let icons fall through and React tried to render the component itself.
  const renderRowIcon = (icon) => {
    if (!icon) return null;
    if (typeof icon === 'string') return <span aria-hidden="true" style={{ fontSize: 17 }}>{icon}</span>;
    if (React.isValidElement(icon)) return icon;
    const I = icon;
    return <I size={18} strokeWidth={1.75} aria-hidden="true" />;
  };
  const row = ({ icon: Icon, label, value, right, onClick, danger, notLast }) => (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', cursor: onClick ? 'pointer' : 'default', borderBottom: notLast ? divider : 'none' }}
    >
      <div style={{ width: '34px', height: '34px', borderRadius: 'var(--r-md)', background: danger ? 'var(--danger-bg)' : 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: danger ? 'var(--danger)' : 'var(--accent)' }}>
        {renderRowIcon(Icon)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: danger ? 'var(--danger)' : 'var(--text-primary)', fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        {value && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>}
      </div>
      {right !== undefined ? right : (onClick ? <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : null)}
    </div>
  );

  return (
    <div className="profile-page" style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', paddingBottom: '120px' }}>

      {/* Identity. The avatar used to take 250px of a 844px screen before a
          single useful number appeared; it is now a row, not a monument. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', marginBottom: 'var(--s-4)' }}>
        <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 'var(--r-pill)',
            background: 'var(--peer)', color: 'var(--text-on-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', fontWeight: 700,
          }}>
            {name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div style={{
            position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px',
            borderRadius: 'var(--r-pill)', background: 'var(--success)',
            border: '3px solid var(--bg-primary)',
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: 'var(--fs-h1)', fontWeight: 700, color: 'var(--text-primary)',
            margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            lineHeight: 'var(--lh-tight)',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'User'}</span>
            {user.teacherVerified && <TutorBadge />}
          </h2>
          {/* Level and plan are facts worth seeing at a glance; the plan used
              to be a whole card that said one word. */}
          <div style={{ display: 'flex', gap: 'var(--s-2)', marginTop: '6px', flexWrap: 'wrap' }}>
            <span className="ui-pill ui-pill--accent"><Signal size={12} strokeWidth={2} />{level}</span>
            <span className="ui-pill">
              {isAdminUser(user) ? 'Pro'
                : mode === 'course' ? 'Course member'
                : isPremium ? 'Pro'
                : user.cohortStatus === 'accepted' ? 'Cohort accepted'
                : user.cohortStatus === 'pending' ? 'Cohort pending'
                : 'Trial'}
            </span>
          </div>
        </div>

        <Button
          variant="ghost" size="sm" iconOnly aria-label="Edit profile"
          onClick={() => setIsEditing(true)}
          icon={<Pencil size={18} strokeWidth={1.75} />}
        />
      </div>

      {/* Bio only when there IS one. The old fallback printed a Bond film
          title under every account that had not written anything. */}
      {bio && (
        <p style={{
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)',
          margin: '0 0 var(--s-4)', lineHeight: 'var(--lh-body)',
        }}>{bio}</p>
      )}

      {/* Four numbers that answer "am I getting anywhere". The old three were
          Feedback / Talks / Mins, which read as trivia rather than progress.
          The emoji is content, not an icon: four 9px uppercase labels in a row
          are four identical grey smudges, and one character in front of each
          gives the eye something to land on. */}
      <Card padding="md" style={{ marginBottom: 'var(--s-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-2)' }}>
          <Stat value={stats.totalMinutes} label="⏱ Minutes" />
          <Stat value={stats.calls} label="🎙 Sessions" />
          <Stat value={streakInfo.count} label="🔥 Streak" />
          <Stat value={avgRating} label="⭐ Rating" />
        </div>
      </Card>

      {/* KURSA QOŞUL — kohorta yeganə girişdir. Əvvəl eyni /redeem düyməsi həm
          burada, həm ana səhifədə vardı; ana səhifədəki silindi, mətn isə
          oradakı kimi izahlı hala gətirildi ki, məna itməsin. */}
      {mode !== 'course' && !user.cohortStatus && (
        <button
          onClick={() => navigate('/redeem')}
          style={{
            width: '100%',
            background: 'var(--accent-soft)',
            border: '1px solid var(--border)', color: 'var(--text-primary)',
            padding: 'var(--s-4)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s-4)',
            display: 'flex', alignItems: 'center', gap: '12px',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <GraduationCap size={22} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--accent)' }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '16px', fontWeight: 700 }}>Join the course</span>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
              Have a code? Apply to a cohort
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        </button>
      )}

      {/* MÜƏLLİM — kilid açılan kimi görünür. Kilidli halda göstərmirik:
          funnel-in mənası odur ki, təklif məhz 3 sessiyadan sonra gəlsin. */}
      {(user.teacherEligible || user.role === 'teacher') && (
        <button
          onClick={() => navigate('/teacher')}
          style={{
            width: '100%',
            background: 'var(--accent-soft)',
            border: '1px solid var(--border)', color: 'var(--text-primary)',
            padding: '16px', borderRadius: '16px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '12px',
            cursor: 'pointer', fontSize: '16px', fontWeight: 700, textAlign: 'left',
          }}
        >
          {user.role === 'teacher'
            ? 'My student code'
            : 'Teacher mode unlocked — create a code'}
        </button>
      )}

      {/* DİL — Türkiyə bazarı üçün. Seçim dərhal tətbiq olunur və
          users/{uid}.preferredLanguage-ə yazılır (cihazlar arası sinxron). */}
      {sectionLabel('Feedback language')}
      <div style={{ ...listCard, display: 'flex', gap: '8px', padding: '10px' }}>
        {FEEDBACK_LANGUAGES.map((lng) => {
          const active = feedbackLang === lng.code;
          return (
            <button
              key={lng.code}
              type="button"
              onClick={() => changeLanguage(lng.code)}
              style={{
                flex: 1, padding: '12px 8px', borderRadius: '12px', cursor: 'pointer',
                border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: 'var(--text-primary)', fontSize: '14px', fontWeight: active ? 800 : 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <span style={{ fontSize: '20px' }}>{lng.flag}</span>
              {lng.label}
              {active && <span style={{ color: 'var(--accent)' }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* ÖYRƏNMƏ */}
      {sectionLabel('Learning')}
      <div style={listCard}>
        {row({ icon: BookMarked, label: 'My words', onClick: () => setShowWordHistory(true), notLast: true })}
        {row({ icon: Flame, label: 'Streak journey', onClick: () => setJourneyOpen(true), right: <span style={{ color: 'var(--warning)', fontWeight: 800, fontSize: '15px', flexShrink: 0 }}>{streakInfo.count}</span>, notLast: true })}
        {/* Above the per-call history on purpose: "how am I doing overall" is
            the question people open this section with, and the list of single
            reports is what they fall back to. */}
        {row({ icon: LineChart, label: 'My progress', onClick: () => navigate('/progress'), notLast: true })}
        {row({ icon: BarChart3, label: 'Analysis history', onClick: () => navigate('/history'), notLast: true })}
        {row({ icon: Trophy, label: 'Leaderboard', onClick: () => navigate('/ranking') })}
      </div>

      {/* MƏLUMAT */}
      {sectionLabel('Info')}
      <div style={listCard}>
        {row({ icon: Signal, label: 'English level', right: <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>{level}</span>, notLast: true })}
        {/* E-poçt AÇIQ göstərilir: müəllim şagirdi məhz e-poçtla dəvət edir,
            şagird isə onu tapa bilmirdi. Uzun ünvan sətri sındırmasın deyə
            kəsilir, yanında kopyalama var. */}
        {row({
          icon: Mail,
          label: 'Email',
          right: (
            <span
              onClick={() => { navigator.clipboard?.writeText(user.email || '').catch(() => {}); }}
              title={user.email || ''}
              style={{
                color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600,
                maxWidth: '58%', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              {user.email || '—'}
            </span>
          ),
        })}
      </div>

      {sectionLabel('Settings')}
      <div style={listCard}>
        {row({
          icon: isDark ? <Moon size={17} /> : <Sun size={17} />,
          label: isDark ? 'Dark mode' : 'Light mode',
          onClick: toggleTheme,
          right: <span className={`theme-switch ${isDark ? 'dark' : 'light'}`} aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0 }}><span className="theme-switch-thumb"></span></span>,
          notLast: true,
        })}
        {row({
          icon: <Bell size={17} />,
          label: 'Push notifications',
          onClick: handleEnableNotifications,
          right: <span style={{ fontSize: '13px', fontWeight: 700, flexShrink: 0, color: notifPerm === 'granted' ? 'var(--success)' : 'var(--accent)' }}>{notifLabel}</span>,
          notLast: true,
        })}
        {/* Personajın səsi söndürülə bilməlidir — səssiz mühitdə tətbiq açan
            adam üçün gözlənilməz səs ən pis təəssüratdır. Zəng zamanı səs
            onsuz da avtomatik kəsilir (bax utils/sfx.js). */}
        {row({
          icon: sfx ? <Volume2 size={17} /> : <VolumeX size={17} />,
          label: 'Sound effects',
          onClick: () => {
            const next = !sfx;
            setSfxEnabled(next);
            setSfx(next);
            if (next) sfxPop();
          },
          right: (
            <span style={{ fontSize: '13px', fontWeight: 700, flexShrink: 0, color: sfx ? 'var(--success)' : 'var(--text-muted)' }}>
              {sfx ? 'On' : 'Off'}
            </span>
          ),
          notLast: true,
        })}
        {row({
          icon: RotateCcw,
          label: 'Reset tours',
          onClick: async () => {
            if (!docId) return;
            try {
              await updateDoc(doc(db, 'users', docId), { tourDone_home: false, tourDone_chat: false, tourDone_profile: false });
              alert('Tours reset. Visit the pages again to see them.');
            } catch (e) { console.error(e); }
          },
        })}
      </div>

      {/* HESAB — Google Play requires an in-app privacy link and a way to
          delete the account together with its data. */}
      {sectionLabel('Account')}
      <div style={listCard}>
        {row({ icon: Shield, label: 'Privacy Policy', onClick: () => window.open('/privacy.html', '_blank'), notLast: true })}
        {row({ icon: Trash2, label: deleting ? 'Deleting…' : 'Delete account', onClick: deleting ? undefined : handleDeleteAccount, danger: true, right: null, notLast: true })}
        {row({ icon: LogOut, label: 'Sign out', onClick: () => { if (window.confirm('Sign out?')) handleLogout(); }, right: null })}
      </div>

      {showWordHistory && (
        <WordHistoryPanel userId={user.uid} onClose={() => setShowWordHistory(false)} />
      )}

      <StreakJourney open={journeyOpen} streakInfo={streakInfo} onClose={() => setJourneyOpen(false)} />

    </div>
  );
}