import React from 'react';
import PremiumBadge from './PremiumBadge';
import AvatarImage from './ui/AvatarImage';
import { useNavigate } from 'react-router-dom';
import { Phone, Clock, Flame, Star } from 'lucide-react';
import { getPresence } from '../utils/presence';

export default function UserCard({ user, onChat }) {
  const navigate = useNavigate();
  // getPresence has always returned THREE states, and .online-badge.busy has
  // always existed in App.css — but this card collapsed the result to a boolean,
  // so somebody in the middle of a call was advertised as "Online". They then
  // got called, and the caller only found out from an alert after the ring
  // failed. The dead CSS class was the giveaway.
  const presence = getPresence(user);

  return (
    <div className="user-card" style={{
      border: user.isPremium ? '1px solid var(--warning-bg)' : undefined,
    }}>
      <div 
        className="user-avatar" 
        onClick={() => navigate(`/user/${user.uid || user.id}`)}
        style={{
          boxShadow: user.isPremium ? '0 0 12px var(--warning-bg)' : undefined,
          cursor: 'pointer'
        }}>
        {user.name?.charAt(0).toUpperCase()}
        <AvatarImage src={user.photo} />
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
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Phone size={11} strokeWidth={2} />{user.callCount || 0}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={11} strokeWidth={2} />{user.totalMinutes || 0} min</span>
          {user.streak > 0 && <span style={{ fontSize: '11px', color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Flame size={11} strokeWidth={2} />{user.streak}</span>}
          {user.ratingCount > 0 && <span style={{ fontSize: '11px', color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Star size={11} strokeWidth={2} />{(user.rating / user.ratingCount).toFixed(1)}</span>}
        </div>
        <span className={`online-badge ${presence}`}>
          {presence === 'busy' ? 'In a call' : presence === 'online' ? 'Online' : 'Offline'}
        </span>
      </div>
      {/* Zəng birinci, profil ikinci. Bu siyahı "indi kim danışa bilər"
          siyahısıdır — cavab görünəndən sonra istənilən şey adamı zəngə
          aparmalıdır, profil oxumağa yox. Offline adama zəng düyməsi
          göstərilmir: onsuz da cavabsız qalacaq. */}
      <div className="user-card-actions">
        {/* Only when genuinely free. A busy person is still "online", but
            startCall would reject them anyway — offering a button that is
            guaranteed to fail is worse than not offering one. */}
        {presence === 'online' && (
          <button
            className="btn-chat"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => navigate(`/chat/${user.uid || user.id}`, { state: { autoCall: true } })}
          >
            <Phone size={15} strokeWidth={2} aria-hidden="true" /> Call
          </button>
        )}
        <button
          className="btn-chat"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          onClick={() => navigate(`/user/${user.uid || user.id}`)}
        >
          View profile
        </button>
      </div>
    </div>
  );
}
