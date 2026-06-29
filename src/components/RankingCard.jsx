import React from 'react';
import PremiumBadge from './PremiumBadge';
import { useNavigate } from 'react-router-dom';

export default function RankingCard({ user, rank, isCurrentUser = false }) {
  const navigate = useNavigate();

  const getMedalEmoji = (rankNumber) => {
    if (rankNumber === 1) return '1st';
    if (rankNumber === 2) return '2nd';
    if (rankNumber === 3) return '3rd';
    return `#${rankNumber}`;
  };

  const getMedalColor = (rankNumber) => {
    if (rankNumber === 1) return '#f59e0b';
    if (rankNumber === 2) return '#9ca3af';
    if (rankNumber === 3) return '#b45309';
    return '#666';
  };

  return (
    <div 
      onClick={() => navigate(`/user/${user.uid || user.id}`)}
      style={{
        background: isCurrentUser ? '#7c6ff71f' : '#1e1e30',
        border: `1px solid ${isCurrentUser ? '#7c6ff7' : rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : rank === 3 ? '#b45309' : '#2e2e50'}`,
        borderRadius: '14px',
        padding: '14px 16px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: isCurrentUser ? '0 0 0 1px #7c6ff733' : 'none',
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
        {user.photo
          ? <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          : user.name?.charAt(0).toUpperCase()
        }
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center' }}>
          {user.name}{isCurrentUser && <span style={{ color: '#7c6ff7', marginLeft: 6 }}>(you)</span>}{user.isPremium && <PremiumBadge />}
        </p>
        <p style={{ fontSize: '11px', color: '#888' }}>{user.level || 'English Speaker'}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontWeight: 700, color: '#7c6ff7', fontSize: '15px' }}>{user.totalMinutes || 0} min</p>
        <p style={{ fontSize: '11px', color: '#888' }}>{user.callCount || 0} calls</p>
        {user.streak > 0 && <p style={{ fontSize: '11px', color: '#f59e0b' }}>Streak {user.streak}</p>}
      </div>
    </div>
  );
}
