import React, { useEffect, useState } from 'react';
import { SearchX } from 'lucide-react';
import { collection, onSnapshot, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE, ADMIN_UID } from '../constants';
import AdminCohorts from '../components/AdminCohorts';
import AdminSlots from '../components/AdminSlots';
import { setTutorVerification } from '../utils/teacher';

const BOT_NOTIFY_URL = `${FUNCTIONS_BASE}/notifyPremiumActivated`;

export default function Admin({ user }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, day, week, month
  const [adminTab, setAdminTab] = useState('premium'); // premium | cohorts | slots
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

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
    
    // We use lastSeen if available, otherwise createdAt
    const time = u.lastSeen?.toMillis?.() || u.createdAt?.toMillis?.() || 0;
    if (!time) return false;

    const now = Date.now();
    const diff = now - time;
    
    if (timeFilter === 'day') return diff <= 24 * 60 * 60 * 1000;
    if (timeFilter === 'week') return diff <= 7 * 24 * 60 * 60 * 1000;
    if (timeFilter === 'month') return diff <= 30 * 24 * 60 * 60 * 1000;
    
    return true;
  };

  const filteredUsers = users
    .filter(u => 
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(filterByTime)
    .sort((a, b) => {
      // Sort by lastSeen descending
      const aTime = a.lastSeen?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bTime = b.lastSeen?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

  return (
    <div className="profile-page" style={{ background: 'var(--bg-card)', minHeight: '100vh', paddingBottom: 'calc(120px + var(--safe-area-bottom, 0px))' }}>
      <div style={{ 
        padding: '20px 16px', 
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', 
            padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            ← Geri
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>
              {{ cohorts: '', slots: '' }[adminTab] || ''}
            </span>
            {{ cohorts: 'Kohortlar', slots: 'Sessions' }[adminTab] || 'Premium management'}
          </h2>
          <div style={{ width: '70px' }}></div> {/* Spacer for center alignment */}
        </div>

        {/* Bölmə keçidi */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {[
            { id: 'premium', label: 'Students' },
            { id: 'cohorts', label: 'Kohortlar' },
            { id: 'slots', label: 'Sessions' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setAdminTab(t.id)}
              style={{
                flex: 1, padding: '8px 12px',
                background: adminTab === t.id ? 'var(--accent)' : 'var(--text-primary)',
                color: adminTab === t.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                border: `1px solid ${adminTab === t.id ? 'var(--accent)' : 'var(--bg-secondary)'}`,
                borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            flex: 1, background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px',
            padding: '12px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)'
          }}>
            <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{users.length}</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: '4px 0 0' }}>All</p>
          </div>
          <div style={{
            flex: 1, background: 'var(--warning-bg)', borderRadius: '12px',
            padding: '12px', textAlign: 'center', border: '1px solid var(--warning-bg)',
            backdropFilter: 'blur(10px)'
          }}>
            <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--warning)', margin: 0 }}>{users.filter(u => u.isPremium).length}</p>
            <p style={{ fontSize: '12px', color: 'var(--warning)', margin: '4px 0 0' }}>Premium</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {adminTab === 'slots' ? <AdminSlots users={users} /> : adminTab === 'cohorts' ? <AdminCohorts /> : (
        <>
        {error && (
          <div style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger-bg)', color: 'var(--danger)',
            borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px',
          }}>
            {error}
          </div>
        )}



        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: '12px 16px',
              background: 'var(--bg-card)', border: '1px solid var(--bg-secondary)',
              borderRadius: '12px', color: 'var(--text-primary)', fontSize: '14px',
              outline: 'none', transition: 'border-color 0.3s'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'all', label: 'All time' },
            { id: 'day', label: 'Last 24 hours' },
            { id: 'week', label: 'Last 7 days' },
            { id: 'month', label: 'Son 1 ay' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id)}
              style={{
                padding: '8px 14px', whiteSpace: 'nowrap',
                background: timeFilter === f.id ? 'var(--accent)' : 'var(--bg-card)',
                color: timeFilter === f.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                border: `1px solid ${timeFilter === f.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '20px', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredUsers.map(u => {
            const isAdmin = u.uid === ADMIN_UID || u.id === ADMIN_UID;
            
            return (
              <div key={u.uid || u.id} style={{
                background: isAdmin ? 'var(--accent-soft)' : 'var(--bg-card)', 
                borderRadius: '16px',
                padding: '16px',
                border: isAdmin ? '2px solid var(--accent)' : `1px solid ${u.isPremium ? 'var(--accent-ring)' : 'var(--border)'}`,
                boxShadow: 'var(--glass-lift)',
                display: 'flex', alignItems: 'center', gap: '14px',
                position: 'relative', overflow: 'hidden'
              }}>
                {isAdmin && (
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: 'var(--accent)', color: 'var(--text-on-accent)',
                    padding: '2px 10px', fontSize: '10px', fontWeight: 800,
                    borderBottomLeftRadius: '10px', textTransform: 'uppercase'
                  }}>
                    Super Admin
                  </div>
                )}
                
                <div style={{
                  width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
                  background: isAdmin ? 'var(--accent)' : (u.isPremium ? 'var(--ai-fill)' : 'var(--bg-secondary)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 700, color: isAdmin ? 'var(--text-on-accent)' : 'var(--text-primary)',
                  border: u.isPremium && !isAdmin ? '2px solid var(--accent)' : 'none'
                }}>
                  {u.name?.charAt(0) || '?'}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.name} {u.isPremium && !isAdmin && ''}
                  </p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: isAdmin ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📞 {u.callCount || 0}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ⏱ {u.totalMinutes || 0} min
                    </span>
                    {!isAdmin && (
                      <span style={{
                        color: u.subscriptionPlan === 'trial' ? 'var(--accent)' : (u.isPremium ? 'var(--warning)' : 'var(--text-muted)'),
                      }}>
                        🎁 {u.isPremium ? (u.premiumPlan || 'pro') : (u.subscriptionPlan || 'free')}
                        {u.subscriptionPlan === 'trial' && !u.isPremium ? ` · ${u.availableTrialMinutes ?? 0} min` : ''}
                      </span>
                    )}
                  </div>
                  {u.tutorProfile && (
                    <p style={{ fontSize: '11px', color: 'var(--ai)', margin: '6px 0 0', lineHeight: 1.45 }}>
                      🎓 {u.tutorProfile.displayName || u.name}
                      {Array.isArray(u.tutorProfile.specialties) && u.tutorProfile.specialties.length > 0
                        ? ` · ${u.tutorProfile.specialties.join(', ')}` : ''}
                      {u.tutorProfile.yearsExperience ? ` · ${u.tutorProfile.yearsExperience} il` : ''}
                      {u.teacherVerified ? ' · ✅ verified' : ' · ⏳ pending'}
                    </p>
                  )}
                </div>
                
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Tutor təsdiqi. teachers/{tid} adminə də oxunmur, ona görə
                      qərar üçün lazım olan profil users/{uid}.tutorProfile-dan
                      göstərilir (server güzgüləyir). */}
                  {!isAdmin && (u.role === 'teacher' || u.teacherEligible) && (
                    <button
                      onClick={() => verifyTutor(u, !u.teacherVerified)}
                      disabled={loading[u.uid || u.id]}
                      style={{
                        padding: '8px 12px', borderRadius: '10px', fontWeight: 700,
                        fontSize: '12px', cursor: 'pointer', width: '130px',
                        border: u.teacherVerified ? '1px solid var(--danger-bg)' : 'none',
                        background: u.teacherVerified
                          ? 'var(--danger-bg)'
                          : 'var(--ai-fill)',
                        color: u.teacherVerified ? 'var(--danger)' : 'var(--text-on-ai)',
                      }}
                    >
                      {loading[u.uid || u.id]
                        ? '...'
                        : (u.teacherVerified ? 'Remove badge' : 'Verify tutor')}
                    </button>
                  )}
                  {isAdmin && !u.teacherEligible && (
                    <button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'users', u.uid || u.id), {
                            teacherEligible: true,
                            role: 'teacher',
                            completedSessions: 3
                          });
                          alert('Teacher access granted.');
                        } catch (e) {
                          alert('Error: ' + e.message);
                        }
                      }}
                      style={{
                        padding: '8px 16px', background: 'var(--accent)',
                        color: 'var(--text-on-accent)', border: 'none', borderRadius: '10px',
                        fontWeight: 700, cursor: 'pointer', fontSize: '12px'
                      }}
                    >
                      Make teacher
                    </button>
                  )}
                  {!isAdmin && (
                    u.isPremium ? (
                      <button
                        onClick={() => setPremium(u, false)}
                        disabled={loading[u.uid || u.id]}
                        style={{
                          padding: '8px 16px', background: 'var(--danger-bg)',
                          color: 'var(--danger)', border: '1px solid var(--danger-bg)',
                          borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                          fontSize: '12px', transition: 'all 0.2s', width: '110px'
                        }}
                      >
                        {loading[u.uid || u.id] ? '...' : 'Cancel'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setPremium(u, true, 'pro')}
                        disabled={loading[u.uid || u.id]}
                        style={{
                          padding: '8px 16px', background: 'var(--warning-solid)',
                          color: 'var(--ink-on-warning)', border: 'none', borderRadius: '10px',
                          fontWeight: 700, cursor: 'pointer', fontSize: '12px',
                          transition: 'all 0.2s', width: '110px'
                        }}
                      >
                        {loading[u.uid || u.id] ? '...' : 'PRO Ver'}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
          
          {filteredUsers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: '16px', color: 'var(--text-muted)' }}><SearchX size={36} strokeWidth={1.5} /></div>
              <p style={{ margin: 0, fontSize: '15px' }}>No users found</p>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
