import React from 'react';
import { Mic, Square, Loader2, Volume2 } from 'lucide-react';
import './ai.css';

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The one control in a session. Tap once to begin; after that it runs itself.
 *
 * The label always describes what is happening RIGHT NOW, because the previous
 * version could show "recording" while the recorder had already stopped and
 * thrown the audio away. Whatever else changes here, the button must never
 * claim a state the session is not in.
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
      : listening ? 'Listening — just talk'
        : busy ? 'One moment'
          : speaking ? 'Tap to interrupt'
            : 'Tap to start';

  const Icon = intro ? Volume2
    : !active ? Mic
      : listening ? Square
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
      <span className="ai-mic-label">
        {listening && elapsedMs > 0 ? fmt(elapsedMs) : label}
      </span>
      {active && !intro && (
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          Tap again to end the session
        </span>
      )}
    </div>
  );
}
