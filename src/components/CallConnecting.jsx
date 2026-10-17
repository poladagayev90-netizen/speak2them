import React from 'react';
import { RotateCw } from 'lucide-react';
import './CallConnecting.css';

// The gap between «Accept» and the partner's voice (Polad 2026-10-17): the
// token, the Agora join and the partner's own join take a few seconds, and
// with nothing on screen people thought the call had failed and left. Shown
// on BOTH sides from the accept until Agora reports the partner in the
// channel; the call screen draws the avatar and name above it. After
// CONNECT_SLOW_AFTER_MS a second line asks them to stay and offers a rejoin, so the
// red End is never the only thing to press.
export const CONNECT_SLOW_AFTER_MS = 10000;

export default function CallConnecting({ slow = false, onRetry }) {
  return (
    <div className="call-connecting" role="status" aria-live="polite">
      <p className="call-connecting-title">Connecting…</p>
      <span className="call-connecting-bar" aria-hidden="true"><span /></span>
      {slow && (
        <>
          <p className="call-connecting-hint">Still connecting — keep the app open</p>
          {onRetry && (
            <button type="button" className="call-connecting-retry" onClick={onRetry}>
              <RotateCw size={15} strokeWidth={2.25} aria-hidden="true" /> Try again
            </button>
          )}
        </>
      )}
    </div>
  );
}
