import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, ChevronDown, Clock3, Copy, EyeOff, Pencil, Trash2 } from 'lucide-react';
import AnalysisMessage from '../AnalysisMessage';
import { Sheet } from '../ui';
import { threadItems, timeLabel, canEditMessage, canDeleteForEveryone } from '../../utils/chatThread';

// The conversation, WhatsApp-style: day lines, grouped bubbles with a tail on
// the last of a run, time and a tick inside the bubble, "edited" when it was.
// A long press (right-click on a computer) opens what you can do with a
// message: copy, edit (yours, 15 minutes), delete for me, delete for everyone.
//
// Scrolling: the thread follows new messages only when you are already at the
// bottom (or the message is yours). Reading older ones is never yanked away;
// a round button shows how many arrived meanwhile.
const LONG_PRESS_MS = 420;
const NEAR_BOTTOM_PX = 120;

function hiddenKey(chatId) { return `chatHidden:${chatId}`; }
function loadHidden(chatId) {
  try { return new Set(JSON.parse(localStorage.getItem(hiddenKey(chatId)) || '[]')); } catch { return new Set(); }
}

export default function ChatThread({ messages, uid, chatId, emptyText, onOpenAnalysis, onEdit, onDelete }) {
  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const lastCountRef = useRef(0);
  const firstPaintRef = useRef(true);
  const [unseen, setUnseen] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [menuFor, setMenuFor] = useState(null);
  const [hidden, setHidden] = useState(() => loadHidden(chatId));
  const [copied, setCopied] = useState(false);
  useEffect(() => setHidden(loadHidden(chatId)), [chatId]);

  const visible = useMemo(() => messages.filter((m) => !hidden.has(m.id)), [messages, hidden]);
  const items = useMemo(() => threadItems(visible), [visible]);

  // Follow new messages only from the bottom, or when they are mine.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = visible.length > lastCountRef.current;
    const last = visible[visible.length - 1];
    if (firstPaintRef.current && visible.length) {
      el.scrollTop = el.scrollHeight;
      firstPaintRef.current = false;
    } else if (grew && (atBottomRef.current || (last && last.senderId === uid))) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      setUnseen(0);
    } else if (grew) {
      setUnseen((n) => n + (visible.length - lastCountRef.current));
    }
    lastCountRef.current = visible.length;
  }, [visible, uid]);

  // The keyboard opening shrinks the view; keep the last message in sight.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => { if (atBottomRef.current) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = near;
    if (near !== atBottom) setAtBottom(near);
    if (near && unseen) setUnseen(0);
  };
  const toBottom = () => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setUnseen(0);
  };

  const hideForMe = (m) => {
    const next = new Set(hidden); next.add(m.id);
    setHidden(next);
    try { localStorage.setItem(hiddenKey(chatId), JSON.stringify([...next].slice(-500))); } catch { /* ignore */ }
  };
  const copy = async (m) => {
    try { await navigator.clipboard.writeText(m.text || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  };

  const menuMsg = menuFor && visible.find((m) => m.id === menuFor);
  const mine = menuMsg && menuMsg.senderId === uid;

  return (
    <div className="ct-wrap">
      <div className="ct" ref={scrollRef} onScroll={onScroll}>
        {items.length === 0 ? (
          <div className="ct-empty"><p>{emptyText}</p></div>
        ) : items.map((it) => (it.type === 'day'
          ? <div key={it.key} className="ct-day"><span>{it.label}</span></div>
          : (
            <Bubble
              key={it.key}
              m={it.msg}
              mine={it.msg.senderId === uid}
              first={it.first}
              last={it.last}
              onMenu={() => !it.msg.deleted && setMenuFor(it.msg.id)}
              onOpenAnalysis={onOpenAnalysis}
            />
          )))}
      </div>

      {!atBottom && (
        <button type="button" className="ct-down" onClick={toBottom} aria-label="Go to the latest message">
          <ChevronDown size={22} />
          {unseen > 0 && <span className="ct-down-count">{unseen}</span>}
        </button>
      )}
      {copied && <div className="ct-toast" role="status">Copied</div>}

      <Sheet open={!!menuMsg} onClose={() => setMenuFor(null)} title="Message">
        {menuMsg && (
          <div className="ct-menu">
            <p className="ct-menu-preview">{menuMsg.text}</p>
            {menuMsg.text && (
              <button type="button" className="ct-menu-item" onClick={() => { copy(menuMsg); setMenuFor(null); }}>
                <Copy size={18} aria-hidden="true" /> Copy
              </button>
            )}
            {mine && canEditMessage(menuMsg, uid) && (
              <button type="button" className="ct-menu-item" onClick={() => { onEdit(menuMsg); setMenuFor(null); }}>
                <Pencil size={18} aria-hidden="true" /> Edit
              </button>
            )}
            <button type="button" className="ct-menu-item" onClick={() => { hideForMe(menuMsg); setMenuFor(null); }}>
              <EyeOff size={18} aria-hidden="true" /> Delete for me
            </button>
            {canDeleteForEveryone(menuMsg, uid) && (
              <button type="button" className="ct-menu-item is-danger" onClick={() => { onDelete(menuMsg); setMenuFor(null); }}>
                <Trash2 size={18} aria-hidden="true" /> Delete for everyone
              </button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

// One message. Memoised: a new message arriving re-renders only itself.
const Bubble = memo(function Bubble({ m, mine, first, last, onMenu, onOpenAnalysis }) {
  const timer = useRef(null);
  const start = () => { clearTimeout(timer.current); timer.current = setTimeout(onMenu, LONG_PRESS_MS); };
  const stop = () => clearTimeout(timer.current);
  const cls = `ct-row ${mine ? 'is-mine' : 'is-theirs'} ${first ? 'is-first' : ''} ${last ? 'is-last' : ''}`;

  if (m.kind === 'analysis') {
    return (
      <div className={`${cls} is-card`}>
        <AnalysisMessage message={m} isMine={mine} onOpen={() => onOpenAnalysis(m, mine)} />
      </div>
    );
  }
  const tick = mine && !m.deleted && (m.pending
    ? <Clock3 size={13} aria-label="Sending" />
    : (m.seen ? <CheckCheck size={14} aria-label="Read" /> : <Check size={14} aria-label="Sent" />));
  return (
    <div className={cls}>
      <div
        className={`ct-bubble ${m.deleted ? 'is-deleted' : ''}`}
        onContextMenu={(e) => { e.preventDefault(); onMenu(); }}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        {m.deleted
          ? <span className="ct-text">This message was deleted</span>
          : <span className="ct-text">{m.text}</span>}
        <span className="ct-meta">
          {m.editedAt && !m.deleted && <span>edited</span>}
          <span>{timeLabel(m.createdAt) || '·'}</span>
          {tick}
        </span>
      </div>
    </div>
  );
});
