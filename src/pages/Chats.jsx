import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { subscribeToBlocked } from '../utils/blocklist';
import { getPresence } from '../utils/presence';
import { subscribeToChats, unreadFor, chatTimeLabel, AINUR_PEER, isAinurId } from '../utils/chat';

// Söhbətlər siyahısı.
//
// Əvvəl: sıralama yox idi (limit(50) təsadüfi 50 söhbət gətirirdi), oxunmamış
// nişanı yox idi, vaxt yox idi, onlayn vəziyyəti yox idi, üstəlik profilə
// girmək kifayət edirdi ki, siyahıda "Hələ mesaj yoxdur" kabus sətri yaransın.
// Nəticədə kimsə sənə yazanda bunu bilməyin yolu yox idi.
export default function Chats({ user }) {
  const [chats, setChats] = useState(null); // null = yüklənir
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const [peers, setPeers] = useState({});
  const navigate = useNavigate();
  const peerCacheRef = useRef({});

  useEffect(() => subscribeToBlocked(user.uid, setBlockedIds), [user.uid]);
  useEffect(() => subscribeToChats(user.uid, setChats), [user.uid]);

  // Qarşı tərəflərin sənədləri — onlayn nişanı və ad üçün. Hər peer üçün canlı
  // dinləyici saxlamırıq (o, hər heartbeat-də bütün siyahını yenidən çəkərdi);
  // bir dəfə oxunur və keşlənir.
  useEffect(() => {
    if (!chats) return;
    const missing = chats
      .map((c) => (c.participants || []).find((p) => p !== user.uid))
      // AInur has no user document to fetch; asking for one returns nothing and
      // the row would fall back to a nameless "User".
      .filter((p) => p && !isAinurId(p) && !peerCacheRef.current[p]);
    if (missing.length === 0) return;
    let alive = true;
    (async () => {
      for (const pid of missing) {
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', pid)));
          peerCacheRef.current[pid] = snap.docs[0]?.data() || { name: 'User' };
        } catch {
          peerCacheRef.current[pid] = { name: 'User' };
        }
      }
      if (alive) setPeers({ ...peerCacheRef.current });
    })();
    return () => { alive = false; };
  }, [chats, user.uid]);

  // Mesajı olmayan söhbətlər siyahıda görünmür. Köhnə kabus sənədləri hələ
  // bazadadır, ona görə filtr client tərəfdə də saxlanılır.
  const rows = (chats || [])
    .map((c) => {
      const peerId = (c.participants || []).find((p) => p !== user.uid);
      if (!peerId) return null;
      return { ...c, peerId, peer: isAinurId(peerId) ? AINUR_PEER : (peers[peerId] || {}) };
    })
    .filter((c) => c && c.lastMessage && !blockedIds.has(c.peerId));

  if (chats === null) {
    return (
      <div className="home-page">
        <div className="home-header"><div className="home-logo">{'Chats'}</div></div>
        <div className="home-body" style={{ paddingBottom: '90px' }}>
          <div className="empty-state"><p>{'Loading...'}</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">{'Chats'}</div>
      </div>
      <div className="home-body" style={{ paddingBottom: '90px' }}>
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"></div>
            <p>No conversations yet.</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Message your partner here before or after a call.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((c) => {
              const unread = unreadFor(c, user.uid);
              const name = c.peer.name || 'User';
              // She has no presence and never will; a dot on her row would be
              // claiming something about a person who is not there.
              const presence = (!isAinurId(c.peerId) && c.peer.lastSeen) ? getPresence(c.peer) : 'offline';
              // A report card is written BY THE SERVER with the student as
              // sender, so the plain check called it the student's own message
              // and prefixed their row with "You:" — a report that had just
              // arrived for them read as one they had sent.
              const mine = c.lastSenderId === user.uid && c.lastKind !== 'analysis';
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/chat/${c.peerId}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/chat/${c.peerId}`); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '13px 14px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: unread > 0 ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div className="user-avatar" style={{ width: '48px', height: '48px', minWidth: '48px', fontSize: '20px' }}>
                      {c.peer.photo
                        ? <img src={c.peer.photo} alt={name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        : name.charAt(0).toUpperCase()}
                    </div>
                    {presence !== 'offline' && (
                      <span style={{
                        position: 'absolute', right: 0, bottom: 0,
                        width: '13px', height: '13px', borderRadius: '50%',
                        background: presence === 'busy' ? 'var(--warning)' : 'var(--success)',
                        border: '2px solid var(--bg-primary)',
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{
                        fontWeight: unread > 0 ? 800 : 700, fontSize: '15px',
                        color: 'var(--text-primary)', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {name}
                      </p>
                      <span style={{
                        marginLeft: 'auto', flexShrink: 0, fontSize: '11px',
                        color: unread > 0 ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: unread > 0 ? 700 : 500,
                      }}>
                        {chatTimeLabel(c.updatedAt)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <p style={{
                        flex: 1, minWidth: 0, margin: 0, fontSize: '13px',
                        color: unread > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: unread > 0 ? 600 : 400,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {mine && <span style={{ color: 'var(--text-muted)' }}>You: </span>}
                        {c.lastMessage}
                      </p>
                      {unread > 0 && (
                        <span style={{
                          flexShrink: 0, minWidth: '20px', height: '20px', padding: '0 6px',
                          borderRadius: '20px', background: 'var(--accent)', color: 'var(--text-on-accent)',
                          fontSize: '11px', fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
