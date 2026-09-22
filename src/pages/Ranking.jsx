import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import HomeRanking from '../components/HomeRanking';
import { PageHeader } from '../components/ui';

// Module-level cache: switching to the Ranking tab remounts this page, and
// without the cache every visit re-fetched and re-parsed the whole list on
// the same frame as the tab transition (visible jank).
const CACHE_TTL_MS = 120000;
let usersCache = { users: null, ts: 0 };

export default function Ranking({ user }) {
  const [allUsers, setAllUsers] = useState(usersCache.users || []);
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

  // One header, like every other tab. The page used to stack four of them
  // ("The practice club / Little by little… / Leaderboard / Leading the way")
  // before the first name appeared.
  return (
    <div className="leaderboard-page">
      <PageHeader
        title="Leaderboard"
        subtitle={tab === 'weekly'
          ? 'Minutes spoken this week, in calls and with AInur. Starts again every Monday.'
          : 'Minutes spoken since each learner joined.'}
      />
      <div className="leaderboard-tabs" role="group" aria-label="Ranking period">
        <button onClick={() => setTab('weekly')} aria-pressed={tab === 'weekly'}>This week</button>
        <button onClick={() => setTab('all')} aria-pressed={tab === 'all'}>All time</button>
      </div>
      {loading ? (
        <p className="leaderboard-loading">Loading the leaderboard…</p>
      ) : (
        <HomeRanking users={allUsers} currentUserId={user.uid} mode={tab === 'weekly' ? 'weekly' : 'all'} />
      )}
    </div>
  );
}
