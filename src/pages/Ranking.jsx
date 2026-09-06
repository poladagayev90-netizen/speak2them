import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import HomeRanking from '../components/HomeRanking';

// Module-level cache: switching to the Ranking tab remounts this page, and
// without the cache every visit re-fetched and re-parsed the whole list on
// the same frame as the tab transition (visible jank).
const CACHE_TTL_MS = 120000;
let usersCache = { users: null, ts: 0 };

export default function Ranking({ user }) {  const [allUsers, setAllUsers] = useState(usersCache.users || []);
  const [loading, setLoading] = useState(!usersCache.users);
  const [tab, setTab] = useState('weekly');

  // Rank the complete roster: all-time top 100 excludes new weekly/AI learners.
  useEffect(() => {
    if (usersCache.users && Date.now() - usersCache.ts < CACHE_TTL_MS) return undefined;
    let cancelled = false;
    setLoading(true);
    getDocs(collection(db, 'users')).then((snap) => {
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
        <div className="home-logo">{'Leaderboard'}</div>
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
                ? 'var(--accent)'
                : 'var(--bg-card)',
              color: tab === 'weekly' ? 'var(--text-on-accent)' : 'var(--text-secondary)',
            }}
          >
            {'This week'}
          </button>
          <button
            onClick={() => setTab('all')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              border: tab === 'all' ? 'none' : '1px solid var(--border)',
              background: tab === 'all'
                ? 'var(--accent)'
                : 'var(--bg-card)',
              color: tab === 'all' ? 'var(--text-on-accent)' : 'var(--text-secondary)',
            }}
          >
            {'All time'}
          </button>
        </div>
        {tab === 'weekly' && (
          <p style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center',
            margin: '0 0 12px',
          }}>
            {'Calls + analysed AInur practice. Resets Monday, Baku time.'}
          </p>
        )}
        {loading ? (
          <div className="empty-state">
            <p>Loading the leaderboard...</p>
          </div>
        ) : allUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Trophy className="empty-icon" size={44} strokeWidth={1.5} aria-hidden="true" />
            <p style={{ color: 'var(--text-secondary)' }}>{'Nobody has practised yet. Be the first.'}</p>
          </div>
        ) : (
          <HomeRanking users={allUsers} currentUserId={user.uid} mode={tab === 'weekly' ? 'weekly' : 'all'} />
        )}
      </div>
    </div>
  );
}
