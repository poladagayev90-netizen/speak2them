import React, { useMemo } from 'react';
import RankingCard from './RankingCard';
import { getUserRank, sortUsersForRanking } from '../utils/ranking';
import { useNavigate } from 'react-router-dom';
import './Ranking.css';

function PodiumCard({ user, rank, isCurrentUser }) {
  const heights = { 1: 120, 2: 90, 3: 70 };
  const emojis = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const navigate = useNavigate();

  return (
    <div 
      className={`ranking-podium-slot rank-${rank}`} 
      onClick={() => navigate(`/user/${user.uid || user.id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="ranking-podium-avatar">
        {user.photo
          ? <img src={user.photo} alt={user.name} />
          : user.name?.charAt(0).toUpperCase()}
      </div>
      <p className="ranking-podium-name">
        {user.name}{isCurrentUser && ' (you)'}
      </p>
      <p className="ranking-podium-minutes">{user.totalMinutes || 0} min</p>
      <div className="ranking-podium-bar" style={{ height: heights[rank] }}>
        <span>{emojis[rank]}</span>
      </div>
    </div>
  );
}

export default function HomeRanking({ users, currentUserId }) {
  const sortedUsers = useMemo(() => sortUsersForRanking(users), [users]);
  const myRank = useMemo(() => getUserRank(sortedUsers, currentUserId), [sortedUsers, currentUserId]);
  const currentUser = sortedUsers.find((u) => (u.uid || u.id) === currentUserId);
  const topThree = sortedUsers.slice(0, 3);
  const rest = sortedUsers.slice(3);
  const podiumOrder = topThree.length >= 3
    ? [topThree[1], topThree[0], topThree[2]]
    : topThree;

  if (sortedUsers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏆</div>
        <p>No rankings yet.</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Complete a call to appear on the board.</p>
      </div>
    );
  }

  return (
    <div className="ranking-board">
      {myRank !== null && (
        <div className="ranking-you-card">
          <div>
            <p className="ranking-you-label">Your position</p>
            <p className="ranking-you-rank">#{myRank}</p>
          </div>
          <div className="ranking-you-stats">
            <span>🕐 {currentUser?.totalMinutes || 0} min</span>
            <span>📞 {currentUser?.callCount || 0} calls</span>
            {(currentUser?.streak || 0) > 0 && <span className="streak-pill">🔥 {currentUser.streak}</span>}
          </div>
        </div>
      )}

      {topThree.length > 0 && (
        <div className="ranking-podium">
          {podiumOrder.map((user) => {
            const rank = sortedUsers.findIndex((u) => (u.uid || u.id) === (user.uid || user.id)) + 1;
            return (
              <PodiumCard
                key={user.uid || user.id}
                user={user}
                rank={rank}
                isCurrentUser={(user.uid || user.id) === currentUserId}
              />
            );
          })}
        </div>
      )}

      {rest.map((user) => {
        const rank = sortedUsers.findIndex((u) => (u.uid || u.id) === (user.uid || user.id)) + 1;
        return (
          <RankingCard
            key={user.uid || user.id}
            user={user}
            rank={rank}
            isCurrentUser={(user.uid || user.id) === currentUserId}
          />
        );
      })}
    </div>
  );
}
