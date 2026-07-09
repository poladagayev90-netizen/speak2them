import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE, ADMIN_UID } from '../constants';

const BOT_NOTIFY_URL = `${FUNCTIONS_BASE}/notifyPremiumActivated`;

export default function Admin({ user }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, day, week, month
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');
  const [backfillMsg, setBackfillMsg] = useState('');
  const navigate = useNavigate();

  const runBackfill = async () => {
    if (!window.confirm('Planı olmayan bütün istifadəçilərə 100 dəqiqəlik trial verilsin?')) return;
    setBackfillMsg('İşlənir...');
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/backfillTrials`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'alınmadı');
      setBackfillMsg(`✅ Trial verildi: ${data.granted} / ${data.total} istifadəçi`);
    } catch (e) {
      setBackfillMsg('Xəta: ' + (e.message || 'alınmadı'));
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

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
    } catch (e) {
      console.error('[Admin] Failed to update premium status:', {
        targetUserId: userId,
        adminUid: user?.uid,
        value,
        error: e,
      });
      setError(e.message || 'Premium status could not be updated.');
    } finally {
      setLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const setTrial = async (u) => {
    const userId = u.uid || u.id;
    if (!userId) { setError('User id is missing.'); return; }
    setError('');
    setLoading(prev => ({ ...prev, [userId]: true }));
    try {
      await updateDoc(doc(db, 'users', userId), {
        subscriptionPlan: 'trial',
        availableTrialMinutes: 100,
        trialGrantedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[Admin] setTrial failed:', e);
      setError(e.message || 'Trial could not be granted.');
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
    <div className="profile-page" style={{ background: '#0f0f17', minHeight: '100vh', paddingBottom: '80px' }}>
      <div style={{ 
        padding: '20px 16px', 
        background: 'linear-gradient(135deg, #161625, #1e1e30)',
        borderBottom: '1px solid #33334d',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <button onClick={() => navigate('/')} style={{
            background: '#2a2a40', color: 'white', border: 'none', 
            padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            ← Geri
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>👑</span> Premium İdarəetmə
          </h2>
          <div style={{ width: '70px' }}></div> {/* Spacer for center alignment */}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            flex: 1, background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px',
            padding: '12px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)'
          }}>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{users.length}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' }}>Ümumi</p>
          </div>
          <div style={{
            flex: 1, background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px',
            padding: '12px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', margin: 0 }}>{users.filter(u => u.isPremium).length}</p>
            <p style={{ fontSize: '12px', color: '#fcd34d', margin: '4px 0 0' }}>Premium</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {error && (
          <div style={{
            background: '#ef444422', border: '1px solid #ef444455', color: '#fecaca',
            borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={runBackfill}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'rgba(124, 111, 247, 0.12)', color: '#7c6ff7',
              border: '1px solid rgba(124, 111, 247, 0.4)', borderRadius: '12px',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            }}
          >
            ⏳ Köhnə istifadəçilərə Trial ver (100 dəq)
          </button>
          {backfillMsg && (
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0', textAlign: 'center' }}>{backfillMsg}</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="İstifadəçi axtar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: '12px 16px',
              background: '#1a1a2e', border: '1px solid #2e2e50',
              borderRadius: '12px', color: 'white', fontSize: '14px',
              outline: 'none', transition: 'border-color 0.3s'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'all', label: 'Bütün vaxtlar' },
            { id: 'day', label: 'Son 24 saat' },
            { id: 'week', label: 'Son 1 həftə' },
            { id: 'month', label: 'Son 1 ay' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id)}
              style={{
                padding: '8px 14px', whiteSpace: 'nowrap',
                background: timeFilter === f.id ? '#f59e0b' : '#1a1a2e',
                color: timeFilter === f.id ? '#000' : '#94a3b8',
                border: `1px solid ${timeFilter === f.id ? '#f59e0b' : '#2e2e50'}`,
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
                background: isAdmin ? 'linear-gradient(135deg, #2c1e4a, #1a1025)' : '#1a1a2e', 
                borderRadius: '16px',
                padding: '16px',
                border: isAdmin ? '2px solid #a855f7' : `1px solid ${u.isPremium ? '#f59e0b55' : '#2e2e50'}`,
                boxShadow: isAdmin ? '0 4px 20px rgba(168, 85, 247, 0.2)' : '0 4px 12px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', gap: '14px',
                position: 'relative', overflow: 'hidden'
              }}>
                {isAdmin && (
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: '#a855f7', color: 'white',
                    padding: '2px 10px', fontSize: '10px', fontWeight: 800,
                    borderBottomLeftRadius: '10px', textTransform: 'uppercase'
                  }}>
                    Super Admin
                  </div>
                )}
                
                <div style={{
                  width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
                  background: isAdmin ? 'linear-gradient(135deg, #d8b4fe, #a855f7)' : (u.isPremium ? 'linear-gradient(135deg, #fcd34d, #f59e0b)' : '#334155'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 700, color: isAdmin ? '#4c1d95' : 'white',
                  border: u.isPremium && !isAdmin ? '2px solid #fff' : 'none'
                }}>
                  {u.name?.charAt(0) || '?'}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: isAdmin ? '#e9d5ff' : '#f8fafc', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.name} {u.isPremium && !isAdmin && '🌟'}
                  </p>
                  <p style={{ fontSize: '12px', color: isAdmin ? '#d8b4fe' : '#94a3b8', margin: '0 0 6px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: isAdmin ? '#a855f7' : '#64748b', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📞 {u.callCount || 0}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ⏱️ {u.totalMinutes || 0} dəq
                    </span>
                  </div>
                </div>
                
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {!isAdmin && (
                    u.isPremium ? (
                      <button
                        onClick={() => setPremium(u, false)}
                        disabled={loading[u.uid || u.id]}
                        style={{
                          padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                          fontSize: '12px', transition: 'all 0.2s', width: '110px'
                        }}
                      >
                        {loading[u.uid || u.id] ? '...' : 'Ləğv et'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setPremium(u, true, 'pro')}
                          disabled={loading[u.uid || u.id]}
                          style={{
                            padding: '8px 16px', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: '#fff', border: 'none', borderRadius: '10px',
                            fontWeight: 700, cursor: 'pointer', fontSize: '12px',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                            transition: 'all 0.2s', width: '110px'
                          }}
                        >
                          {loading[u.uid || u.id] ? '...' : 'PRO Ver ✨'}
                        </button>
                        <button
                          onClick={() => setTrial(u)}
                          disabled={loading[u.uid || u.id]}
                          style={{
                            padding: '8px 16px', background: 'rgba(124, 111, 247, 0.12)',
                            color: '#7c6ff7', border: '1px solid rgba(124, 111, 247, 0.4)',
                            borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                            fontSize: '12px', transition: 'all 0.2s', width: '110px'
                          }}
                        >
                          {loading[u.uid || u.id] ? '...' : 'TRIAL 100dəq ⏳'}
                        </button>
                      </>
                    )
                  )}
                </div>
              </div>
            );
          })}
          
          {filteredUsers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
              <p style={{ margin: 0, fontSize: '15px' }}>Heç bir istifadəçi tapılmadı</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
