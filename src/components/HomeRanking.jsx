import React from 'react';
import RankingCard from './RankingCard';

export default function HomeRanking({ users }) {
  if (users.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏆</div>
        <p>No rankings yet.</p>
      </div>
    );
  }

  const sorted = [...users]
    .sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0));

  return (
    <div>
      {sorted.map((u, i) => (
        <RankingCard key={u.uid} user={u} rank={i} />
      ))}
    </div>
  );
}
