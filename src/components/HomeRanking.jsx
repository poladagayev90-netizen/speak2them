import React, { useMemo } from 'react';
import RankingCard from './RankingCard';

export default function HomeRanking({ users, currentUserId }) {
  const sorted = useMemo(() => {
    return users
      .map((user, index) => ({ user, index }))
      .sort((a, b) => {
        const minutesDiff = (b.user.totalMinutes || 0) - (a.user.totalMinutes || 0);
        if (minutesDiff !== 0) return minutesDiff;

        const nameDiff = (a.user.name || '').localeCompare(b.user.name || '');
        if (nameDiff !== 0) return nameDiff;

        return (a.user.uid || '').localeCompare(b.user.uid || '') || a.index - b.index;
      })
      .map(({ user }) => user);
  }, [users]);

  const myRank = sorted.findIndex(u => u.uid === currentUserId) + 1;

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏆</div>
        <p>No rankings yet.</p>
      </div>
    );
  }

  return (
    <div>
      {myRank > 0 && (
        <div style={{
          background: '#7c6ff722',
          border: '1px solid #7c6ff755',
          color: '#d8d4ff',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
          fontSize: '13px',
          fontWeight: 700,
        }}>
          Your rank: #{myRank}
        </div>
      )}
      {sorted.map((u, i) => (
        <RankingCard
          key={u.uid}
          user={u}
          rank={i + 1}
          isCurrentUser={u.uid === currentUserId}
        />
      ))}
    </div>
  );
}
