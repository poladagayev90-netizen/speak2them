import React, { useMemo } from 'react';
import RankingCard from './RankingCard';

export default function HomeRanking({ users, currentUserId }) {
  const sortedUsers = useMemo(() => {
    return users
      .map((user, index) => ({ user, index }))
      .sort((a, b) => {
        const minutesDiff = (b.user.totalMinutes || 0) - (a.user.totalMinutes || 0);
        if (minutesDiff !== 0) return minutesDiff;

        const nameDiff = (a.user.name || '').localeCompare(b.user.name || '');
        if (nameDiff !== 0) return nameDiff;

        return (a.user.uid || a.user.id || '').localeCompare(b.user.uid || b.user.id || '') || a.index - b.index;
      })
      .map(({ user }) => user);
  }, [users]);

  const myRank = sortedUsers.findIndex(u => u.uid === currentUserId || u.id === currentUserId) + 1;

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
      {sortedUsers.map((u, i) => (
        <RankingCard
          key={u.id || u.uid}
          user={u}
          rank={i + 1}
          isCurrentUser={u.uid === currentUserId || u.id === currentUserId}
        />
      ))}
    </div>
  );
}
