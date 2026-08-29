import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { db } from '../firebase';
import { chatIdFor, markChatRead, AINUR_UID } from '../utils/chat';
import AnalysisMessage from '../components/AnalysisMessage';

// The AInur thread.
//
// A learner with no teacher had nowhere for a finished report to arrive. It was
// written, it was in History, and there was nothing anywhere to say so — you
// had to already know to go looking. Everything else in the app that wants to
// be noticed arrives in Chats and shows a number, so this does too.
//
// A SEPARATE PAGE, not a branch inside Chat.jsx. That file is the human
// conversation: presence, typing, the whole Agora call and its five in-call
// stages, all of it built around a peer who is a real account. AInur is none of
// those things, and threading an `isAinur` exception through every one of them
// would be a much larger change with a much larger blast radius than a screen
// that shows what she has sent.
//
// There is no composer, deliberately. You do not type at AInur — you speak to
// her, on the practice screen — so an input box here would be a promise the
// app does not keep. The button at the bottom goes where the talking happens.
export default function AinurChat({ user }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState(null);   // null = loading
  const chatId = chatIdFor(user.uid, AINUR_UID);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100),
    );
    return onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setMessages([]),
    );
  }, [chatId]);

  // Opening the thread is reading it. Runs once on mount rather than on every
  // snapshot: a report that lands while the learner is looking at this screen
  // has been seen too.
  useEffect(() => { markChatRead(chatId, user.uid); }, [chatId, user.uid]);

  return (
    <div className="home-page">
      {/* justify-content is overridden: .home-header spaces its children apart,
          which is right for a page title and a control on the far side, and
          wrong for a back arrow, a face and a name that belong together. */}
      <div
        className="home-header"
        style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start' }}
      >
        <button
          type="button"
          onClick={() => navigate('/chats')}
          aria-label="Back"
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--text-primary)', display: 'flex',
          }}
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <img
          src="/ainur_avatar.png"
          alt=""
          style={{ width: 34, height: 34, borderRadius: '50%' }}
        />
        <div className="home-logo" style={{ margin: 0 }}>AInur</div>
      </div>

      <div className="home-body" style={{ paddingBottom: '90px' }}>
        {messages === null ? (
          <div className="empty-state"><p>Loading…</p></div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <p>No reports yet.</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Finish a practice session and AInur sends your report here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', padding: 'var(--s-3)' }}>
            {messages.map((m) => (
              <div key={m.id}>
                {m.kind === 'analysis' ? (
                  /* isMine is about who the report is ABOUT, and it is always
                     this learner — she never sends anyone else's. */
                  <AnalysisMessage
                    message={m}
                    isMine
                    onOpen={() => navigate('/history')}
                  />
                ) : (
                  <p className="ai-bubble-text">{m.text}</p>
                )}
                <p style={{
                  margin: 'var(--s-1) 0 0', fontSize: 'var(--fs-xs)',
                  fontWeight: 600, color: 'var(--text-muted)',
                }}>
                  {m.createdAt && m.createdAt.toDate
                    ? m.createdAt.toDate().toLocaleString()
                    : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: 'var(--s-3)' }}>
          <button
            type="button"
            onClick={() => navigate('/ai-chat')}
            style={{
              width: '100%', padding: 'var(--s-3)', cursor: 'pointer',
              borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              fontSize: '14px', fontWeight: 700,
            }}
          >
            Practise with AInur
          </button>
        </div>
      </div>
    </div>
  );
}
