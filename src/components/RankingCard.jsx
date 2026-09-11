import React from 'react';
import PremiumBadge from './PremiumBadge';
import TutorBadge from './TutorBadge';
import AvatarImage from './ui/AvatarImage';
import { useNavigate } from 'react-router-dom';

export default function RankingCard({ user, rank, isCurrentUser = false, displayMinutes }) {
  const navigate = useNavigate();
  return (
    <button className={`ranking-row ${isCurrentUser ? 'is-you' : ''}`} onClick={() => navigate(`/user/${user.uid || user.id}`)}>
      <span className="ranking-row-place">{String(rank).padStart(2, '0')}</span>
      <span className="user-avatar ranking-row-avatar">
        {user.name?.charAt(0).toUpperCase()}<AvatarImage src={user.photo} />
      </span>
      <span className="ranking-row-person">
        <span className="ranking-row-name">{user.name}{isCurrentUser && <small>you</small>}{user.teacherVerified && <TutorBadge />}{user.isPremium && <PremiumBadge />}</span>
        <span className="ranking-row-level">{user.level || 'English Speaker'}</span>
      </span>
      <span className="ranking-row-score"><strong>{displayMinutes ?? (user.totalMinutes || 0)}</strong><span>min</span></span>
    </button>
  );
}
