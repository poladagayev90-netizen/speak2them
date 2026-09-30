import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Phone, Star, Link2, Check } from 'lucide-react';
import { buildPracticeLink, inviteMessage } from '../utils/invite';
import '../components/ui/ui.css';
import { subscribeToBlocked } from '../utils/blocklist';
import { subscribeToFavorites, setFavorite } from '../utils/favorites';
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
  const [favIds, setFavIds] = useState(() => new Set());
  const [peers, setPeers] = useState({});
  const navigate = useNavigate();
  const peerCacheRef = useRef({});

  useEffect(() => subscribeToBlocked(user.uid, setBlockedIds), [user.uid]);
  useEffect(() => subscribeToChats(user.uid, setChats), [user.uid]);
  useEffect(() => subscribeToFavorites(user.uid, setFavIds), [user.uid]);

  // Qarşı tərəflərin sənədləri — onlayn nişanı və ad üçün. Hər peer üçün canlı
  // dinləyici saxlamırıq (o, hər heartbeat-də bütün siyahını yenidən çəkərdi);
  // bir dəfə oxunur və keşlənir.
  useEffect(() => {
    if (!chats) return;
    // Publish cached results even if a previous effect was cancelled while
    // reading profiles by a newer chat snapshot.
    setPeers({ ...peerCacheRef.current });
    const missing = [...new Set(chats
      .map((c) => (c.participants || []).find((p) => p !== user.uid))
      // AInur has no user document to fetch; asking for one returns nothing and
      // the row would fall back to a nameless "User".
      .filter((p) => p && !isAinurId(p) && !peerCacheRef.current[p]))];
    if (missing.length === 0) return;
    let alive = true;
    missing.forEach(async (pid) => {
        try {
          // Profiles are keyed by uid; legacy profiles need not contain a uid field.
          const snap = await getDoc(doc(db, 'users', pid));
          if (!alive) return;
          if (snap.exists()) {
            peerCacheRef.current[pid] = snap.data();
            setPeers((prev) => ({ ...prev, [pid]: snap.data() }));
          } else {
            setPeers((prev) => ({ ...prev, [pid]: { name: 'Unavailable account' } }));
          }
        } catch (error) {
          // Do not permanently cache a temporary network/permission failure.
          if (alive) setPeers((prev) => ({ ...prev, [pid]: { name: 'Could not load profile' } }));
          console.error('[chats] profile', error);
        }
    });
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
    .filter((c) => c && c.lastMessage && !blockedIds.has(c.peerId))
    // AInur is always there, so she stays at the top; starred partners come
    // next; everyone else follows by the latest message (the query order).
    .sort((a, b) => (isAinurId(b.peerId) - isAinurId(a.peerId)) || (favIds.has(b.peerId) - favIds.has(a.peerId)));

  if (chats === null) {
    return (
      <div className="home-page">
        <div className="home-header"><div className="home-logo">Partners</div></div>
        <div className="home-body" style={{ paddingBottom: '90px' }}>
          <div className="empty-state"><p>{'Loading...'}</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">Partners</div>
      </div>
      <div className="home-body" style={{ paddingBottom: '90px' }}>
        {/* Partners replaced both Chats and the Live tab's people list: the
            people you have actually practised with (a chat appears after every
            real call — functions/postCallChat.js), each one message or one
            call away. Talking to someone you already know stays free and
            unplanned; only NEW partners come through the weekly plan. */}
        <p style={{ margin: '0 0 var(--s-3)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          People you have practised with. Message or call them any time. Star the ones you
          would like to practise with again — your weekly plan pairs you with them more often.
        </p>
        <InviteCard user={user} />
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"></div>
            <p>No partners yet.</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
              After your first practice, the person you talked with appears here —
              or send a friend your link above.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((c) => {
              const unread = unreadFor(c, user.uid);
              const name = c.peer.name || c.peer.displayName || (peers[c.peerId] ? 'Unnamed account' : 'Loading...');
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
                  {!isAinurId(c.peerId) && (
                    <button
                      type="button"
                      aria-pressed={favIds.has(c.peerId)}
                      aria-label={favIds.has(c.peerId) ? `Remove ${name} from favourites` : `Practise with ${name} again`}
                      title={favIds.has(c.peerId) ? 'In your favourites' : 'Practise with them again'}
                      onClick={(e) => { e.stopPropagation(); setFavorite(user.uid, c.peerId, !favIds.has(c.peerId), name).catch(() => {}); }}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{
                        flexShrink: 0, width: '40px', height: '40px', borderRadius: 'var(--r-pill)',
                        border: 'none', background: 'transparent',
                        color: favIds.has(c.peerId) ? 'var(--accent)' : 'var(--text-muted)',
                        display: 'grid', placeItems: 'center', cursor: 'pointer',
                      }}
                    >
                      <Star size={20} strokeWidth={2} fill={favIds.has(c.peerId) ? 'currentColor' : 'none'} aria-hidden="true" />
                    </button>
                  )}
                  {!isAinurId(c.peerId) && (
                    <button
                      type="button"
                      aria-label={`Call ${name}`}
                      onClick={(e) => { e.stopPropagation(); navigate(`/chat/${c.peerId}`, { state: { autoCall: true } }); }}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{
                        flexShrink: 0, width: '40px', height: '40px', borderRadius: 'var(--r-pill)',
                        border: '1px solid var(--accent-ring)', background: 'var(--accent-soft)', color: 'var(--accent)',
                        display: 'grid', placeItems: 'center', cursor: 'pointer',
                      }}
                    >
                      <Phone size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// "Practise with a friend": two learners who agreed a time on WhatsApp but
// have never talked in the app cannot find each other here (Partners lists
// only people you have practised with, and random search is gone). The link
// opens a chat with you; everything after that is the ordinary chat and call.
function InviteCard({ user }) {
  const [copied, setCopied] = useState(false);
  const link = buildPracticeLink(user.uid);
  const text = inviteMessage(user.name, link);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the WhatsApp button still works */ }
  };
  return (
    <section className="partners-invite" aria-label="Practise with a friend">
      <p className="partners-invite-title">Practise with a friend</p>
      <p className="partners-invite-text">
        Arranged a time on WhatsApp? Send your link — it opens a chat with you, and you can call from there.
      </p>
      <div className="partners-invite-actions">
        <a className="ui-btn ui-btn--primary ui-btn--sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
          Share on WhatsApp
        </a>
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={copy}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </section>
  );
}
