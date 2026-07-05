import React from 'react';
import PremiumBadge from './PremiumBadge';
import { useNavigate } from 'react-router-dom';

export default function UserCard({ user, onChat }) {
  const navigate = useNavigate();

  return (
    <div className="user-card" style={{
      border: user.isPremium ? '1px solid #f59e0b55' : undefined,
    }}>
      <div 
        className="user-avatar" 
        onClick={() => navigate(`/user/${user.uid || user.id}`)}
        style={{
          boxShadow: user.isPremium ? '0 0 12px #f59e0b66' : undefined,
          cursor: 'pointer'
        }}>
        {user.photo
          ? <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          : user.name?.charAt(0).toUpperCase()
        }
      </div>
      <div className="user-info">
        <h3 
          onClick={() => navigate(`/user/${user.uid || user.id}`)}
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}
        >
          {user.name}{user.isPremium && <PremiumBadge />}
        </h3>
        <span className="user-level">{user.level || 'English Speaker'}</span>
        {user.bio && (
          <p className="user-bio">
            {(user.uid || user.id) === '6Djehd9KB8dTZUgVwVJfLoPI5dF3'
              ? user.bio
              : user.bio.split(' ').slice(0, 2).join(' ') + (user.bio.split(' ').length > 2 ? '...' : '')}
          </p>
        )}
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#888' }}>📞 {user.callCount || 0}</span>
          <span style={{ fontSize: '11px', color: '#888' }}>🕐 {user.totalMinutes || 0} dəq</span>
          {user.streak > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>🔥 {user.streak}</span>}
          {user.ratingCount > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>⭐ {(user.rating / user.ratingCount).toFixed(1)}</span>}
        </div>
        <span className={`online-badge ${user.lastSeen?.toMillis?.() > Date.now() - 180000 ? 'online' : 'offline'}`}>
          {user.lastSeen?.toMillis?.() > Date.now() - 180000 ? '🟢 Online' : '⚫ Offline'}
        </span>
      </div>
      <button className="btn-chat" onClick={() => navigate(`/user/${user.uid || user.id}`)}>
        👀 View Profile
      </button>
    </div>
  );
}
