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
    <div className="home-page leaderboard-page">
      <div className="home-body leaderboard-content">
        {/* One compact row (Polad 2026-11-10): the old two-line hero pushed
            «Your position» and the podium below the fold on a phone, and the
            board is the point of this page. */}
        <header className="leaderboard-toolbar">
        <h1><Trophy size={20} strokeWidth={2} aria-hidden="true" />Practice Club</h1>
        <div className="leaderboard-tabs" aria-label="Ranking period">
          <button
            onClick={() => setTab('weekly')}
            aria-pressed={tab === 'weekly'}
          >
            {'This week'}
          </button>
          <button
            onClick={() => setTab('all')}
            aria-pressed={tab === 'all'}
          >
            {'All time'}
          </button>
        </div>
        </header>
        <p className="leaderboard-note">
          {tab === 'weekly'
            ? 'Calls + analysed AInur practice. Resets Monday, Baku time.'
            : 'Every minute you have practised. Little by little.'}
        </p>
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
