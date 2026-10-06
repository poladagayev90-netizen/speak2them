import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, Check, Keyboard, Pencil, Send, Smile, X } from 'lucide-react';
import { EMOJI_GROUPS, recentEmoji, rememberEmoji } from './emoji';

// The message bar at the bottom of a conversation, WhatsApp-style: an emoji
// key and a growing text box in one pill, today's topic at its right edge,
// and a round send button. It owns the text it holds — in Chat.jsx the text
// was state of the whole 1,900-line call screen, so every letter re-rendered
// the call UI and typing stuttered.
//
// Enter sends on a computer (Shift+Enter = new line); on a phone Enter is a new
// line and the button sends, as in every messenger.
const MAX_LINES_PX = 132;
const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export default function ChatComposer({ onSend, editing, onSaveEdit, onCancelEdit, onTopic }) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [group, setGroup] = useState('recent');
  const boxRef = useRef(null);

  // Editing loads the message into the box; leaving edit empties it.
  useEffect(() => {
    if (editing) {
      setText(editing.text || '');
      requestAnimationFrame(() => {
        const el = boxRef.current;
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    } else {
      setText('');
    }
  }, [editing]);

  // Grow with the text up to ~5 lines, then scroll inside.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_LINES_PX)}px`;
  }, [text]);

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    if (editing) {
      if (value !== (editing.text || '').trim()) onSaveEdit(editing, value);
      else onCancelEdit();
    } else {
      onSend(value);
    }
    setText('');
  };

  const insert = (e) => {
    rememberEmoji(e);
    const el = boxRef.current;
    if (!el) { setText((t) => t + e); return; }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + e + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      const pos = start + e.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const recents = recentEmoji();
  const groups = recents.length ? [{ key: 'recent', label: 'Recent', list: recents }, ...EMOJI_GROUPS] : EMOJI_GROUPS;
  const shown = groups.find((g) => g.key === group) || groups[0];

  return (
    <div className="cc">
      {editing && (
        <div className="cc-editing">
          <Pencil size={16} aria-hidden="true" />
          <span className="cc-editing-text">
            <b>Editing</b>
            <span>{editing.text}</span>
          </span>
          <button type="button" className="cc-icon" aria-label="Cancel editing" onClick={onCancelEdit}><X size={18} /></button>
        </div>
      )}

      <form
        className="cc-bar"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <div className="cc-pill">
          <button
            type="button"
            className="cc-icon"
            aria-label={emojiOpen ? 'Keyboard' : 'Emoji'}
            aria-pressed={emojiOpen}
            onClick={() => {
              setEmojiOpen((o) => !o);
              // Opening the panel puts the keyboard away on a phone, like WhatsApp.
              if (!emojiOpen && coarse()) boxRef.current?.blur();
              else boxRef.current?.focus();
            }}
          >
            {emojiOpen ? <Keyboard size={22} /> : <Smile size={22} />}
          </button>
          <textarea
            ref={boxRef}
            className="cc-input"
            rows={1}
            maxLength={4000}
            placeholder="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => { if (coarse()) setEmojiOpen(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !coarse()) { e.preventDefault(); submit(); }
              if (e.key === 'Escape' && editing) onCancelEdit();
            }}
            aria-label="Message"
            data-no-reveal="true"
          />
          {!editing && (
            <button type="button" className="cc-icon" aria-label="Today's topic" title="Today's topic" onClick={onTopic}>
              <BookOpen size={21} />
            </button>
          )}
        </div>
        <button type="submit" className="cc-send" aria-label={editing ? 'Save' : 'Send'} disabled={!text.trim()}>
          {editing ? <Check size={22} /> : <Send size={20} />}
        </button>
      </form>

      {emojiOpen && (
        <div className="cc-emoji" role="dialog" aria-label="Emoji">
          <div className="cc-emoji-tabs" role="tablist">
            {groups.map((g) => (
              <button key={g.key} type="button" role="tab" aria-selected={shown.key === g.key}
                className={`cc-emoji-tab ${shown.key === g.key ? 'is-on' : ''}`} onClick={() => setGroup(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="cc-emoji-grid">
            {shown.list.map((e) => (
              <button key={e} type="button" className="cc-emoji-key" onClick={() => insert(e)} aria-label={e}>{e}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
