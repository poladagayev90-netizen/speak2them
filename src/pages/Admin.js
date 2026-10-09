import React, { useEffect, useRef, useState } from 'react';
import { Clock, Gift, MessageCircle, Phone, SearchX } from 'lucide-react';
import { collection, onSnapshot, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSearchParams } from 'react-router-dom';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE, ADMIN_UID } from '../constants';
import AdminSlots from '../components/AdminSlots';
import AdminApplicants from '../components/AdminApplicants';
import AdminIntros from '../components/AdminIntros';
import AdminWeekPlan from '../components/AdminWeekPlan';
import AdminMatching from '../components/AdminMatching';
import AdminAttendance from '../components/AdminAttendance';
import AdminActivity from '../components/AdminActivity';
import AdminAppVersion from '../components/AdminAppVersion';
import { BillingSwitch, PackageMenu, SuspendButton, packageLabel, usePackageSummaries } from '../components/AdminPackages';
import { setTutorVerification } from '../utils/teacher';
import { stableOrder } from '../utils/stableOrder';
import { TABS, adminTabOf } from '../utils/adminNav';
import { whatsAppLink } from '../utils/onboarding';
import '../components/AdminApplicants.css';
import './Admin.css';

const BOT_NOTIFY_URL = `${FUNCTIONS_BASE}/notifyPremiumActivated`;

export default function Admin({ user }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, day, week, month
  // ?tab= is the state: a push opens the right tab (notifyAdminOnboarding →
  // applicants) and the bottom nav switches groups by changing it.
  const [params, setParams] = useSearchParams();
  const adminTab = adminTabOf(params.get('tab'));
  const setAdminTab = (id) => setParams({ tab: id }, { replace: true });
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');

  const [rawUsers, setRawUsers] = useState([]);
  // WhatsApp numbers (onboarding/{uid}.whatsapp, team-only) for the Students
  // list — listened to only while that tab is open.
  const [phones, setPhones] = useState({});
  useEffect(() => {
    if (adminTab !== 'premium') return undefined;
    return onSnapshot(collection(db, 'onboarding'), (snap) => {
      setPhones(Object.fromEntries(snap.docs.filter((d) => d.get('whatsapp')).map((d) => [d.id, d.get('whatsapp')])));
    }, () => {});
  }, [adminTab]);
  const packageSummaries = usePackageSummaries();
  const [emails, setEmails] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setRawUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // E-poçtlar artıq users sənədində DEYİL: o sənədi hər daxil olmuş hesab
  // oxuya (və siyahılaya) bilir, yəni hər kəsin e-poçtu bir sorğu ilə
  // toplana bilirdi. Admin onları Firebase Auth-dan, yalnız adminə açıq
  // adminUserEmails funksiyası ilə alır və burada birləşdirir — alt tablar
  // (Applicants, Intros, Slots…) `u.email`-i əvvəlki kimi görür.
  useEffect(() => {
    let alive = true;
    authedFetch(`${FUNCTIONS_BASE}/adminUserEmails`, { method: 'POST' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => { if (alive && body && body.emails) setEmails(body.emails); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setUsers(rawUsers.map(u => ({ ...u, email: emails[u.id] || u.email || '' })));
  }, [rawUsers, emails]);

  // Tutor nişanı. Serverdən keçir, çünki teachers/{tid} sənədi rules-da hər kəsə
  // (admin daxil) yazılmazdır və users/{tid}.teacherVerified ilə birgə atomik
  // yenilənməlidir. Siyahı onSnapshot ilə canlıdır — əl ilə yeniləmə lazım deyil.
  const verifyTutor = async (u, verified) => {
    const userId = u.uid || u.id;
    if (!userId) return;
    setLoading(prev => ({ ...prev, [userId]: true }));
    const res = await setTutorVerification(userId, verified);
    setLoading(prev => ({ ...prev, [userId]: false }));
    if (!res.ok) alert('Error: ' + res.errorText);
  };

  const setPremium = async (u, value, planType = 'pro') => {
    const userId = u.uid || u.id;

    if (!userId) {
      setError('User id is missing. Premium status could not be updated.');
      return;
    }

    setError('');
    setLoading(prev => ({ ...prev, [userId]: true }));

    try {
      const userRef = doc(db, 'users', userId);
      const premiumRequestRef = doc(db, 'premiumRequests', userId);

      await updateDoc(userRef, {
        isPremium: value,
        premiumSince: value ? serverTimestamp() : null,
        premiumPlan: value ? planType : null,
      });

      const requestSnap = await getDoc(premiumRequestRef);

      if (value) {
        const requestUpdate = {
          uid: userId,
          status: 'active',
          planGranted: planType,
          activatedAt: serverTimestamp(),
          activatedBy: user.uid,
        };

        if (requestSnap.exists()) {
          await updateDoc(premiumRequestRef, requestUpdate);
        } else {
          await setDoc(premiumRequestRef, {
            ...requestUpdate,
            name: u.name || '',
            email: u.email || '',
            requestedAt: serverTimestamp(),
          });
        }

        await authedFetch(BOT_NOTIFY_URL, {
          method: 'POST',
          body: JSON.stringify({ userId, userName: u.name }),
        }).catch(() => {});
      } else if (requestSnap.exists()) {
        await updateDoc(premiumRequestRef, {
          status: 'revoked',
          revokedAt: serverTimestamp(),
          revokedBy: user.uid,
        });
      }
      alert(`Premium status updated for ${u.name || 'User'}.`);
    } catch (e) {
      console.error('[Admin] Failed to update premium status:', {
        targetUserId: userId,
        adminUid: user?.uid,
        value,
        error: e,
      });
      setError(e.message || 'Premium status could not be updated.');
      alert('Premium error: ' + (e.message || 'Not updated.'));
    } finally {
      setLoading(prev => ({ ...prev, [userId]: false }));
    }
  };


  const filterByTime = (u) => {
    if (timeFilter === 'all') return true;
    // lastSeen if available, otherwise createdAt
    const time = u.lastSeen?.toMillis?.() || u.createdAt?.toMillis?.() || 0;
    if (!time) return false;
    const diff = Date.now() - time;
    if (timeFilter === 'day') return diff <= 24 * 60 * 60 * 1000;
    if (timeFilter === 'week') return diff <= 7 * 24 * 60 * 60 * 1000;
    if (timeFilter === 'month') return diff <= 30 * 24 * 60 * 60 * 1000;
    return true;
  };

  // Most recently seen first — but only when the list is (re)built. lastSeen
  // changes live while people use the app, and re-sorting on every tick moved
  // rows under the admin's finger (stableOrder).
  const rankRef = useRef({ key: '', rank: new Map() });
  const orderKey = `${search}|${timeFilter}`;
  if (rankRef.current.key !== orderKey) rankRef.current = { key: orderKey, rank: new Map() };
  const seenMs = (u) => u.lastSeen?.toMillis?.() || u.createdAt?.toMillis?.() || 0;
  const filteredUsers = stableOrder(
    users
      .filter((u) => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
      .filter(filterByTime),
    (a, b) => seenMs(b) - seenMs(a),
    rankRef.current.rank,
  );

  const current = TABS.find((t) => t.id === adminTab);
  const groupTabs = TABS.filter((t) => t.group === current.group);

  return (
    <div className="adm">
      <header className="adm-head">
        <div className="adm-top">
          <h1 className="adm-title">Admin <span className="adm-sub">· {current.label}</span></h1>
        </div>
        {/* Only this group's tabs; a group of one needs no row. */}
        {groupTabs.length > 1 && <nav className="adm-tabs" aria-label="Admin sections">
          {groupTabs.map((t) => (
            <button key={t.id} type="button" className={`adm-tab ${adminTab === t.id ? 'is-on' : ''}`}
              aria-current={adminTab === t.id ? 'page' : undefined} onClick={() => setAdminTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>}
      </header>

      <main className={`adm-body ${adminTab === 'matching' ? 'adm-body--wide' : ''}`}>
        {adminTab === 'activity' ? <AdminActivity users={users} />
          : adminTab === 'matching' ? <AdminMatching users={users} />
          : adminTab === 'week' ? <AdminWeekPlan users={users} />
          : adminTab === 'attendance' ? <AdminAttendance users={users} />
          : adminTab === 'intros' ? <AdminIntros users={users} />
          : adminTab === 'applicants' ? <AdminApplicants users={users} />
          : adminTab === 'slots' ? <AdminSlots users={users} />
          : (
          <div className="adm-students">
            {error && <p className="aa-error">{error}</p>}
            <BillingSwitch />
            <AdminAppVersion />
            <div className="adm-stats">
              <span><b>{users.length}</b> accounts</span>
              <span><b>{users.filter((u) => u.isPremium).length}</b> premium</span>
              <span><b>{filteredUsers.length}</b> shown</span>
            </div>
            <input className="adm-search" type="search" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="aa-filters">
              {[
                { id: 'all', label: 'All time' },
                { id: 'day', label: '24 hours' },
                { id: 'week', label: '7 days' },
                { id: 'month', label: '30 days' },
              ].map((f) => (
                <button key={f.id} type="button" className={`aa-chip ${timeFilter === f.id ? 'is-on' : ''}`} onClick={() => setTimeFilter(f.id)}>{f.label}</button>
              ))}
            </div>

            <ul className="adm-list">
              {filteredUsers.map((u) => {
                const id = u.uid || u.id;
                const isAdmin = id === ADMIN_UID;
                const busy = !!loading[id];
                const plan = isAdmin ? 'pro · admin' : u.isPremium ? (u.premiumPlan || 'pro') : (u.subscriptionPlan || 'free');
                return (
                  <li key={id} className={`adm-user ${isAdmin ? 'is-admin' : ''} ${u.isPremium ? 'is-premium' : ''}`}>
                    <span className="adm-avatar" aria-hidden="true">{u.name?.charAt(0) || '?'}</span>
                    <div className="adm-user-main">
                      <p className="adm-user-name">{u.name || 'No name'}{isAdmin && <span className="aa-badge">admin</span>}{u.suspended && <span className="aa-badge">suspended</span>}</p>
                      <p className="adm-user-email">{u.email}</p>
                      <p className="adm-user-meta">
                        <span><Phone size={12} aria-hidden="true" /> {u.callCount || 0}</span>
                        <span><Clock size={12} aria-hidden="true" /> {u.totalMinutes || 0} min</span>
                        <span><Gift size={12} aria-hidden="true" /> {u.isPremium || isAdmin ? plan : (packageLabel(packageSummaries[id]) || plan)}</span>
                      </p>
                      {u.tutorProfile && (
                        <p className="adm-user-meta">
                          Tutor: {u.tutorProfile.displayName || u.name}
                          {Array.isArray(u.tutorProfile.specialties) && u.tutorProfile.specialties.length > 0 ? ` · ${u.tutorProfile.specialties.join(', ')}` : ''}
                          {u.tutorProfile.yearsExperience ? ` · ${u.tutorProfile.yearsExperience} years` : ''}
                          {u.teacherVerified ? ' · verified' : ' · pending'}
                        </p>
                      )}
                    </div>
                    <div className="adm-user-actions">
                      {phones[id] && (
                        <a className="adm-btn adm-btn--soft adm-btn--link" href={whatsAppLink(phones[id], u.name)}
                          target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${u.name || ''}`} title={phones[id]}>
                          <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                        </a>
                      )}
                      {/* Tutor badge: teachers/{tid} is unreadable even for the
                          admin, so the profile shown comes from users/{uid}.tutorProfile. */}
                      {!isAdmin && (u.role === 'teacher' || u.teacherEligible) && (
                        <button type="button" className={`adm-btn ${u.teacherVerified ? 'adm-btn--danger' : 'adm-btn--soft'}`}
                          disabled={busy} onClick={() => verifyTutor(u, !u.teacherVerified)}>
                          {busy ? '…' : (u.teacherVerified ? 'Remove badge' : 'Verify tutor')}
                        </button>
                      )}
                      {isAdmin && !u.teacherEligible && (
                        <button type="button" className="adm-btn" onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'users', id), { teacherEligible: true, role: 'teacher', completedSessions: 3 });
                            alert('Teacher access granted.');
                          } catch (e) {
                            alert('Error: ' + e.message);
                          }
                        }}>Make teacher</button>
                      )}
                      {!isAdmin && !u.isPremium && <PackageMenu uid={id} summary={packageSummaries[id]} />}
                      {!isAdmin && (u.isPremium
                        ? <button type="button" className="adm-btn adm-btn--danger" disabled={busy} onClick={() => setPremium(u, false)}>{busy ? '…' : 'Remove Pro'}</button>
                        : <button type="button" className="adm-btn" disabled={busy} onClick={() => setPremium(u, true, 'pro')}>{busy ? '…' : 'Make Pro'}</button>)}
                      {!isAdmin && <SuspendButton uid={id} name={u.name} suspended={!!u.suspended} />}
                    </div>
                  </li>
                );
              })}
            </ul>
            {filteredUsers.length === 0 && (
              <div className="adm-empty"><SearchX size={36} strokeWidth={1.5} /><p>No users found</p></div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
