import React from 'react';
import PremiumBadge from './PremiumBadge';
import TutorBadge from './TutorBadge';
import AvatarImage from './ui/AvatarImage';
import { useNavigate } from 'react-router-dom';

export default function RankingCard({ user, rank, isCurrentUser = false, displayMinutes }) {
  const navigate = useNavigate();

  const getMedalEmoji = (rankNumber) => {
    if (rankNumber === 1) return '1st';
    if (rankNumber === 2) return '2nd';
    if (rankNumber === 3) return '3rd';
    return `#${rankNumber}`;
  };

  // Gold/silver/bronze as literal metals would be three foreign hues on a
  // screen that is nothing but a list, so --gold/--silver/--bronze are a
  // lightness ramp of the one purple: first place deepest, third palest.
  const getMedalColor = (rankNumber) => {
    if (rankNumber === 1) return 'var(--gold)';
    if (rankNumber === 2) return 'var(--silver)';
    if (rankNumber === 3) return 'var(--bronze)';
    return 'var(--text-secondary)';
  };

  const borderColor = isCurrentUser
    ? 'var(--accent)'
    : rank <= 3 ? getMedalColor(rank) : 'var(--border)';

  return (
    <div
      onClick={() => navigate(`/user/${user.uid || user.id}`)}
      style={{
        background: isCurrentUser ? 'var(--accent-soft)' : 'var(--bg-card)',
        border: `1px solid ${borderColor}`,
        borderRadius: '14px',
        padding: '14px 16px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: isCurrentUser ? '0 0 0 1px var(--accent-soft)' : 'none',
        cursor: 'pointer'
      }}
    >
      <div style={{
        fontSize: '16px',
        fontWeight: 800,
        minWidth: '36px',
        textAlign: 'center',
        color: getMedalColor(rank),
      }}>
        {getMedalEmoji(rank)}
      </div>
      <div className="user-avatar" style={{ width: '40px', height: '40px', minWidth: '40px' }}>
        {user.name?.charAt(0).toUpperCase()}
        <AvatarImage src={user.photo} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center' }}>
          {user.name}{isCurrentUser && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>(you)</span>}{user.teacherVerified && <TutorBadge />}{user.isPremium && <PremiumBadge />}
        </p>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{user.level || 'English Speaker'}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '15px' }}>{displayMinutes ?? (user.totalMinutes || 0)} min</p>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{user.callCount || 0} calls</p>
        {user.streak > 0 && <p style={{ fontSize: '11px', color: 'var(--gold)' }}>Streak {user.streak}</p>}
      </div>
    </div>
  );
}
