import React from 'react';
import { Mic, Square, Loader2, Volume2 } from 'lucide-react';
import './ai.css';

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The one control in an activity. Tap to start, tap to stop.
 *
 * The ring around it tracks the microphone input, which does one useful job
 * beyond decoration: a learner who is too quiet to be transcribed can see that
 * before they finish talking, instead of finding out from an error afterwards.
 */
export default function MicButton({ status, level = 0, elapsedMs = 0, onStart, onStop, disabled }) {
  const recording = status === 'recording';
  const busy = status === 'sending';
  const speaking = status === 'speaking';

  const label = recording ? 'Stop' : speaking ? 'Tap to interrupt' : busy ? 'Sending' : 'Tap to speak';
  const Icon = recording ? Square : busy ? Loader2 : speaking ? Volume2 : Mic;

  // Cap the glow so a loud room does not blow the ring off the screen.
  const glow = Math.min(level, 0.6);

  return (
    <div className="ai-mic-wrap">
      <button
        type="button"
        className={`ai-mic ai-mic--${recording ? 'rec' : speaking ? 'speaking' : busy ? 'busy' : 'idle'}`}
        style={recording ? { boxShadow: `0 0 0 ${6 + glow * 26}px var(--ai-soft)` } : undefined}
        onClick={recording ? onStop : onStart}
        disabled={disabled || busy}
        aria-label={label}
      >
        <Icon size={30} strokeWidth={2} className={busy ? 'ai-spin' : undefined} />
      </button>
      <span className="ai-mic-label">
        {recording ? fmt(elapsedMs) : label}
      </span>
    </div>
  );
}
