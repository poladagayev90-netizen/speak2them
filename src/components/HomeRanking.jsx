import React, { useMemo } from 'react';
import { Crown, Clock, Phone, Flame, Trophy } from 'lucide-react';
import RankingCard from './RankingCard';
import TutorBadge from './TutorBadge';
import AvatarImage from './ui/AvatarImage';
import { getUserRank, sortUsersForRanking, weeklyMinutesOf } from '../utils/ranking';
import { useNavigate } from 'react-router-dom';
import './Ranking.css';

function PodiumCard({ user, rank, isCurrentUser, displayMinutes }) {
  // A gentler staircase than before (was 120/90/70 in a 240px well, which left
  // a large dead gap under the shortest column). The steps still read as first,
  // second and third; they just stop dominating the screen.
  const heights = { 1: 104, 2: 78, 3: 60 };
  const navigate = useNavigate();
  const initial = user.name?.charAt(0).toUpperCase();

  return (
    <div
      className={`ranking-podium-slot rank-${rank}`}
      onClick={() => navigate(`/user/${user.uid || user.id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="ranking-podium-avatar">
        {/* The initial sits UNDER the photo rather than being replaced by
            it — see AvatarImage for the failure this avoids. */}
        <span className="ranking-podium-initial" aria-hidden="true">{initial}</span>
        <AvatarImage src={user.photo} />
        {rank === 1 && (
          <Crown className="ranking-crown" size={22} strokeWidth={2.25} aria-hidden="true" />
        )}
      </div>
      <p className="ranking-podium-name">
        {user.name}{isCurrentUser && ' (you)'}{user.teacherVerified && <TutorBadge />}
      </p>
      <p className="ranking-podium-minutes">
        <strong>{displayMinutes ?? (user.totalMinutes || 0)}</strong> min
      </p>
      {/* The bar carries the placing. It used to be an empty slab of colour
          with an empty <span> left over from the removed medal emoji, so the
          podium never actually said which step was which. */}
      <div className="ranking-podium-bar" style={{ height: heights[rank] }}>
        <span className="ranking-podium-place">{rank}</span>
      </div>
    </div>
  );
}

export default function HomeRanking({ users, currentUserId, mode = 'all' }) {
  const sortedUsers = useMemo(() => sortUsersForRanking(users, mode), [users, mode]);
  const myRank = useMemo(() => getUserRank(sortedUsers, currentUserId), [sortedUsers, currentUserId]);
  const currentUser = sortedUsers.find((u) => (u.uid || u.id) === currentUserId);
  const minutesOf = (u) => (mode === 'weekly' ? weeklyMinutesOf(u) : (u.totalMinutes || 0));
  const topThree = sortedUsers.slice(0, 3);
  const rest = sortedUsers.slice(3);
  const podiumOrder = topThree.length >= 3
    ? [topThree[1], topThree[0], topThree[2]]
    : topThree;

  if (sortedUsers.length === 0) {
    return (
      <div className="empty-state">
        <Trophy className="empty-icon" size={44} strokeWidth={1.5} aria-hidden="true" />
        <p>No rankings yet.</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, marginTop: 8 }}>Complete a call to appear on the board.</p>
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
          {/* Each pill used to open with a stray space where an emoji had been
              removed, and the streak was a bare number with nothing to say what
              it counted — a lone "1" floating beside the minutes. */}
          <div className="ranking-you-stats">
            <span>
              <Clock size={13} strokeWidth={2} aria-hidden="true" />
              {currentUser ? minutesOf(currentUser) : 0} min
            </span>
            <span>
              <Phone size={13} strokeWidth={2} aria-hidden="true" />
              {currentUser?.callCount || 0} calls
            </span>
            {(currentUser?.streak || 0) > 0 && (
              <span className="streak-pill">
                <Flame size={13} strokeWidth={2} aria-hidden="true" />
                {currentUser.streak} day streak
              </span>
            )}
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
                displayMinutes={minutesOf(user)}
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
            displayMinutes={minutesOf(user)}
          />
        );
      })}
    </div>
  );
}
