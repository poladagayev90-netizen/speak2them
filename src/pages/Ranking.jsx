import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import HomeRanking from '../components/HomeRanking';

// Module-level cache: switching to the Ranking tab remounts this page, and
// without the cache every visit re-fetched and re-parsed the whole list on
// the same frame as the tab transition (visible jank).
const CACHE_TTL_MS = 120000;
let usersCache = { users: null, ts: 0 };

export default function Ranking({ user }) {
  const [allUsers, setAllUsers] = useState(usersCache.users || []);
  const [loading, setLoading] = useState(!usersCache.users);
  const [tab, setTab] = useState('weekly');

  // One-shot read: a leaderboard doesn't need realtime, and a live listener
  // on the whole collection re-streams every presence heartbeat to every
  // viewer (read amplification at scale). Top-100 by all-time minutes also
  // bounds the weekly board — with a small base the active weekly players
  // are inside that set.
  useEffect(() => {
    if (usersCache.users && Date.now() - usersCache.ts < CACHE_TTL_MS) return undefined;
    let cancelled = false;
    setLoading(true);
    getDocs(query(
      collection(db, 'users'),
      orderBy('totalMinutes', 'desc'),
      limit(100)
    )).then((snap) => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      usersCache = { users, ts: Date.now() };
      if (!cancelled) { setAllUsers(users); setLoading(false); }
    }).catch((e) => {
      console.error('[Ranking] load failed:', e);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">🏆 Rankings</div>
      </div>
      <div className="home-body" style={{ paddingBottom: '90px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button
            onClick={() => setTab('weekly')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              border: tab === 'weekly' ? 'none' : '1px solid var(--border)',
              background: tab === 'weekly'
                ? 'linear-gradient(135deg, var(--accent), var(--accent-strong))'
                : 'var(--bg-card)',
              color: tab === 'weekly' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            ⚡ Həftəlik
          </button>
          <button
            onClick={() => setTab('all')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              border: tab === 'all' ? 'none' : '1px solid var(--border)',
              background: tab === 'all'
                ? 'linear-gradient(135deg, var(--accent), var(--accent-strong))'
                : 'var(--bg-card)',
              color: tab === 'all' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            🏆 Ümumi
          </button>
        </div>
        {tab === 'weekly' && (
          <p style={{
            fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
            margin: '0 0 12px',
          }}>
            Hər bazar ertəsi sıfırlanır — bu həftə hamı bərabər başlayır! 🚀
          </p>
        )}
        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Sıralama yüklənir...</p>
          </div>
        ) : allUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
            <p style={{ color: 'var(--text-secondary)' }}>Hələ heç kim məşq etməyib. İlk sən ol!</p>
          </div>
        ) : (
          <HomeRanking users={allUsers} currentUserId={user.uid} mode={tab === 'weekly' ? 'weekly' : 'all'} />
        )}
      </div>
    </div>
  );
}
