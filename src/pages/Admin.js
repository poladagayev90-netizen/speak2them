import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

const BOT_NOTIFY_URL = `${FUNCTIONS_BASE}/notifyPremiumActivated`;

export default function Admin({ user }) {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [tab, setTab] = useState('requests');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'premiumRequests'), snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'waitlist'), snap => {
      setWaitlist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

        if (u.telegramId) {
          await authedFetch(BOT_NOTIFY_URL, {
            method: 'POST',
            body: JSON.stringify({ telegramId: u.telegramId, userName: u.name }),
          }).catch(() => {});
        }
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
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
        <h2>🛡️ Admin Panel</h2>
      </div>

      <div style={{ padding: '0 16px 40px' }}>
        {error && (
          <div style={{
            background: '#ef444422',
            border: '1px solid #ef444455',
            color: '#fecaca',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'İstifadəçi', val: users.length },
            { label: 'Premium', val: users.filter(u => u.isPremium).length },
            { label: 'Sorğu', val: pendingRequests.length },
            { label: 'Gözləyən', val: waitlist.length },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, background: '#1e1e30', borderRadius: '12px',
              padding: '14px', textAlign: 'center', border: '1px solid #2e2e50',
            }}>
              <p style={{ fontSize: '22px', fontWeight: 800, color: '#7c6ff7' }}>{s.val}</p>
              <p style={{ fontSize: '11px', color: '#888' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {['requests', 'users', 'waitlist'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px',
              background: tab === t ? '#7c6ff7' : '#1e1e30',
              color: 'white', border: 'none', borderRadius: '10px',
              fontWeight: 600, cursor: 'pointer', fontSize: '13px',
            }}>
              {t === 'requests' ? `📨 Sorğular (${pendingRequests.length})` : t === 'waitlist' ? `⏳ Gözləyən (${waitlist.length})` : '👥 İstifadəçilər'}
            </button>
          ))}
        </div>

        {/* Premium Requests */}
        {tab === 'requests' && (
          <div>
            {pendingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                Gözləyən sorğu yoxdur
              </div>
            ) : (
              pendingRequests.map(req => {
                const u = users.find(u => u.uid === req.uid) || req;
                return (
                  <div key={req.id} style={{
                    background: '#1e1e30', borderRadius: '14px',
                    padding: '16px', marginBottom: '12px',
                    border: '1px solid #f59e0b44',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px', fontWeight: 700, color: 'white',
                      }}>
                        {req.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700 }}>{req.name}</p>
                        <p style={{ fontSize: '12px', color: '#888' }}>{req.email}</p>
                        <p style={{ fontSize: '11px', color: '#666' }}>
                          {req.requestedAt?.toDate?.()?.toLocaleDateString() || ''}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={() => setPremium(u, true, 'basic')}
                        disabled={loading[u.uid]}
                        style={{
                          flex: 1, padding: '10px',
                          background: '#185FA5', color: '#fff', border: 'none', borderRadius: '8px',
                          fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                        }}
                      >
                        Basic
                      </button>
                      <button
                        onClick={() => setPremium(u, true, 'pro')}
                        disabled={loading[u.uid]}
                        style={{
                          flex: 1, padding: '10px',
                          background: '#7c6ff7', color: '#fff', border: 'none', borderRadius: '8px',
                          fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                        }}
                      >
                        Pro
                      </button>
                      <button
                        onClick={() => setPremium(u, true, 'unlimited')}
                        disabled={loading[u.uid]}
                        style={{
                          flex: 1, padding: '10px',
                          background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px',
                          fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                        }}
                      >
                        ∞
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* All Users */}
        {tab === 'users' && (
          <div>
            <input
              type="text"
              placeholder="Ad və ya email axtar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', marginBottom: '16px',
                background: '#1e1e30', border: '1px solid #2e2e50',
                borderRadius: '12px', color: 'white', fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
            {filteredUsers.map(u => (
              <div key={u.uid} style={{
                background: '#1e1e30', borderRadius: '14px',
                padding: '14px 16px', marginBottom: '10px',
                border: `1px solid ${u.isPremium ? '#f59e0b44' : '#2e2e50'}`,
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 700, color: 'white',
                }}>
                  {u.name?.charAt(0) || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '14px' }}>
                    {u.name} {u.isPremium && '👑'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#888' }}>{u.email}</p>
                  <p style={{ fontSize: '11px', color: '#666' }}>
                    📞 {u.callCount || 0} · 🕐 {u.totalMinutes || 0} dəq
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {u.isPremium ? (
                    <button
                      onClick={() => setPremium(u, false)}
                      disabled={loading[u.uid]}
                      style={{
                        padding: '6px 12px', background: '#ef444422',
                        color: '#ef4444', border: '1px solid #ef444444',
                        borderRadius: '6px', fontWeight: 700,
                        cursor: 'pointer', fontSize: '11px',
                      }}
                    >
                      {loading[u.uid] ? '...' : 'Ləğv et'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => setPremium(u, true, 'basic')} disabled={loading[u.uid]}
                        style={{ padding: '6px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}>
                        B
                      </button>
                      <button onClick={() => setPremium(u, true, 'pro')} disabled={loading[u.uid]}
                        style={{ padding: '6px', background: '#7c6ff7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}>
                        P
                      </button>
                      <button onClick={() => setPremium(u, true, 'unlimited')} disabled={loading[u.uid]}
                        style={{ padding: '6px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}>
                        ∞
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Waitlist */}
        {tab === 'waitlist' && (
          <div>
            {waitlist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                Heç kim yoxdur
              </div>
            ) : (
              waitlist.map(w => (
                <div key={w.id} style={{
                  background: '#1e1e30', borderRadius: '14px',
                  padding: '14px 16px', marginBottom: '10px',
                  border: '1px solid #2e2e50',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: 700, color: 'white',
                  }}>
                    📧
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '14px', margin: '0 0 4px 0' }}>
                      {w.email}
                    </p>
                    <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>
                      {w.createdAt?.toDate?.()?.toLocaleString() || ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
