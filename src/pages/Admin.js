import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

const BOT_NOTIFY_URL = 'https://us-central1-speak2them-64f2b.cloudfunctions.net/notifyPremiumActivated';

export default function Admin({ user }) {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
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

  const setPremium = async (u, value) => {
    setError('');
    setLoading(prev => ({ ...prev, [u.uid]: true }));
    try {
      await setDoc(doc(db, 'users', u.uid), {
        isPremium: value,
        premiumSince: value ? new Date().toISOString() : null,
      }, { merge: true });

      // Premium sorğusunu tamamla
      if (value) {
        await setDoc(doc(db, 'premiumRequests', u.uid), {
          status: 'activated',
          activatedAt: new Date().toISOString(),
        }, { merge: true });

        // İstifadəçiyə bot bildirişi göndər
        if (u.telegramId) {
          await fetch(BOT_NOTIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: u.telegramId, userName: u.name }),
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error('Failed to update premium status:', e);
      setError(e.message || 'Premium status could not be updated.');
    }
    setLoading(prev => ({ ...prev, [u.uid]: false }));
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
          {['requests', 'users'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px',
              background: tab === t ? '#7c6ff7' : '#1e1e30',
              color: 'white', border: 'none', borderRadius: '10px',
              fontWeight: 600, cursor: 'pointer', fontSize: '13px',
            }}>
              {t === 'requests' ? `📨 Sorğular (${pendingRequests.length})` : '👥 İstifadəçilər'}
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
                    <button
                      onClick={() => setPremium(u, true)}
                      disabled={loading[u.uid]}
                      style={{
                        width: '100%', padding: '12px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#1a1000', border: 'none', borderRadius: '10px',
                        fontWeight: 700, cursor: 'pointer', fontSize: '14px',
                      }}
                    >
                      {loading[u.uid] ? '...' : '👑 Premium aktivləşdir'}
                    </button>
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
                <button
                  onClick={() => setPremium(u, !u.isPremium)}
                  disabled={loading[u.uid]}
                  style={{
                    padding: '8px 12px', flexShrink: 0,
                    background: u.isPremium ? '#ef444422' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: u.isPremium ? '#ef4444' : '#1a1000',
                    border: u.isPremium ? '1px solid #ef444444' : 'none',
                    borderRadius: '8px', fontWeight: 700,
                    cursor: 'pointer', fontSize: '12px',
                  }}
                >
                  {loading[u.uid] ? '...' : u.isPremium ? 'Sil' : '👑 Ver'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
