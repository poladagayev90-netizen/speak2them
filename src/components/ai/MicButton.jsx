import React from 'react';
import { Mic, Send, Loader2, Volume2 } from 'lucide-react';
import './ai.css';

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The one control in a session. Tap once to begin; after that it runs itself,
 * and a tap while it is listening means "I have finished this answer".
 *
 * The label always describes what is happening RIGHT NOW, because the previous
 * version could show "recording" while the recorder had already stopped and
 * thrown the audio away. Whatever else changes here, the button must never
 * claim a state the session is not in.
 *
 * THE ICON IS PART OF THAT PROMISE. While listening it used to be a stop
 * square beside a running timer — which every voice UI in the world means
 * "send" — and tapping it ended the whole session and deleted the answer. It
 * is a send arrow now, and it does what it says. The session is ended by the
 * Finish button underneath, never from here.
 */
export default function MicButton({ status, active, intro = false, level = 0, elapsedMs = 0, onTap, disabled }) {
  const listening = !intro && status === 'listening';
  const busy = !intro && status === 'sending';
  // `intro` is the one spoken line at the top of a session. It is a separate
  // flag rather than a status because the session has not started yet — the
  // microphone deliberately stays shut until she has finished.
  const speaking = intro || status === 'speaking';

  const label = intro ? 'AInur is asking — tap to skip'
    : !active ? 'Tap to start'
      : listening ? 'Listening — tap when you finish'
        : busy ? 'One moment'
          : speaking ? 'Tap to interrupt'
            : 'Tap to start';

  const Icon = intro ? Volume2
    : !active ? Mic
      : listening ? Send
        : busy ? Loader2
          : speaking ? Volume2 : Mic;

  const mode = speaking ? 'speaking' : !active ? 'idle' : listening ? 'rec' : busy ? 'busy' : 'idle';
  // Cap the ring so a loud room does not blow it off the screen.
  const glow = Math.min(level, 0.6);

  return (
    <div className="ai-mic-wrap">
      <button
        type="button"
        className={`ai-mic ai-mic--${mode}`}
        style={listening ? { boxShadow: `0 0 0 ${6 + glow * 26}px var(--ai-soft)` } : undefined}
        onClick={onTap}
        disabled={disabled}
        aria-label={label}
      >
        <Icon size={30} strokeWidth={2} className={busy ? 'ai-spin' : undefined} />
      </button>
      {/* The timer alone was the whole label while listening, which left the
          button looking like a recorder with a stop control and nothing saying
          what a tap would do. The sentence stays; the clock joins it. */}
      <span className="ai-mic-label">
        {listening && elapsedMs > 0 ? `${fmt(elapsedMs)} · tap when you finish` : label}
      </span>
      {active && !intro && (
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
          Or just pause — she answers on her own
        </span>
      )}
    </div>
  );
}
