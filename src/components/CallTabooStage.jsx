import React, { useEffect, useMemo, useRef, useState } from 'react';
import StageCard from './StageCard';
import { X, Check, SkipForward } from 'lucide-react';
import { tabooWords } from '../data/tabooWords';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Confetti is the one place a spread of colour is the point, so it takes six
// steps of the purple rather than six unrelated hues -- the burst still reads
// as a burst, and it no longer contradicts every other colour on the screen.
const CONFETTI_COLORS = ['#b6a6ff', '#c9b8ff', '#8fa3e8', '#dfa6f0', '#a37fe8', '#e3d8ff'];

const makeConfetti = () =>
  Array.from({ length: 18 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 70 + Math.random() * 90;
    return {
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance + 40, // bias downward so shards fall
      rot: Math.round(Math.random() * 720 - 360),
      delay: Math.round(Math.random() * 120),
    };
  });

const CARD_BASE = {
  position: 'relative',
  borderRadius: 20,
  padding: '22px 18px',
  minHeight: 268,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  // Background, edge and ink come from StageCard (the hero drift).
};

// In-call synchronized Taboo game. Both peers read the same tabooStage doc field,
// but the explainer and the guesser render completely different screens: the word
// is never mounted for the guesser.
export default function CallTabooStage({ cardIndex, score, isExplainer, onCorrect, onPass, onClose }) {
  const reduceMotion = prefersReducedMotion();
  const card = tabooWords[cardIndex % tabooWords.length];

  const [burstKey, setBurstKey] = useState(0);
  const [toast, setToast] = useState('');
  const prevScore = useRef(score);
  const prevExplainer = useRef(isExplainer);

  // Celebrate on both sides whenever the shared score goes up.
  useEffect(() => {
    if (score > prevScore.current) setBurstKey((k) => k + 1);
    prevScore.current = score;
  }, [score]);

  useEffect(() => {
    if (!burstKey) return undefined;
    const t = setTimeout(() => setBurstKey(0), 1200);
    return () => clearTimeout(t);
  }, [burstKey]);

  useEffect(() => {
    if (isExplainer === prevExplainer.current) return undefined;
    prevExplainer.current = isExplainer;
    setToast(isExplainer ? 'Your turn' : 'Your partner is explaining');
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [isExplainer]);

  const confetti = useMemo(() => (burstKey ? makeConfetti() : []), [burstKey]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-stage)',
      // A dim behind the sheet. Without it the call screen reads straight
      // through every gap around the panel -- avatar, name, timer and the End
      // button competing with the activity's own text, which is exactly how
      // this looked once --bg-card went translucent. pointerEvents stays
      // 'none', so the call controls underneath remain reachable mid-activity.
      background: 'var(--overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto', width: '100%', maxWidth: 360, position: 'relative',
        background: 'var(--bg-card)',
        borderRadius: 'var(--r-xl)', border: '1px solid var(--border)',
        boxShadow: 'var(--glass-edge), var(--e-3)',
        overflow: 'hidden',
      }}>
        {burstKey > 0 && !reduceMotion && (
          <div className="taboo-confetti-layer" aria-hidden="true">
            {confetti.map((p, i) => (
              <span
                key={`${burstKey}-${i}`}
                className="taboo-confetti-piece"
                style={{
                  left: '50%',
                  background: p.color,
                  animationDelay: `${p.delay}ms`,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  '--rot': `${p.rot}deg`,
                }}
              />
            ))}
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px',
        }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: 0 }}>
            Taboo
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              key={score}
              className={reduceMotion ? undefined : 'taboo-score-pop'}
              style={{
                display: 'inline-block',
                background: 'var(--accent)', color: 'var(--text-on-accent)',
                borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700,
              }}
            >
              Score: {score}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                fontSize: 18, cursor: 'pointer', padding: '2px 6px',
              }}
            >
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        {toast && (
          <div
            className={reduceMotion ? undefined : 'taboo-toast'}
            style={{
              margin: '0 16px 10px', padding: '8px 12px', borderRadius: 12,
              background: 'var(--accent-soft)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}
          >
            {toast}
          </div>
        )}

        <div style={{ padding: '0 16px' }}>
          {isExplainer ? (
            <StageCard key={cardIndex} className="taboo-card" style={CARD_BASE}>
              <p style={{
                color: 'var(--stage-ink-soft)', fontSize: 10, fontWeight: 700, margin: '0 0 10px',
                textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'center',
              }}>
                Explain this word
              </p>
              <h2 style={{
                color: 'var(--stage-ink)', fontSize: 34, fontWeight: 800, letterSpacing: '2px',
                textAlign: 'center', margin: '0 0 16px',
              }}>
                {card.word}
              </h2>

              <div style={{
                height: 1, margin: '0 0 14px',
                background: 'linear-gradient(90deg, transparent, var(--stage-no-border), transparent)',
              }} />

              <p style={{
                /* The card is the drifting hero purple, not a page surface, so
                   the page's danger tokens do not fit it: --stage-no is a pale
                   coral on the deep purples (light mode) and a deep red on the
                   pastels (dark mode). */
                color: 'var(--stage-no)', fontSize: 10, fontWeight: 700, margin: '0 0 10px',
                textTransform: 'uppercase', letterSpacing: '1.2px', textAlign: 'center',
              }}>
                Forbidden words
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {card.forbidden.map((w) => (
                  <div key={w} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--stage-no-chip)',
                    border: '1px solid var(--stage-no-border)',
                    borderRadius: 10, padding: '7px 12px',
                    color: 'var(--stage-no)', fontSize: 14, fontWeight: 700,
                  }}>
                    <X size={16} strokeWidth={2.5} aria-hidden="true" style={{ color: 'var(--stage-no)' }} />
                    {w}
                  </div>
                ))}
              </div>
            </StageCard>
          ) : (
            <StageCard key={cardIndex} className="taboo-card" style={{ ...CARD_BASE, alignItems: 'center' }}>
              <div
                className={reduceMotion ? undefined : 'taboo-orb'}
                aria-hidden="true"
                style={{
                  width: 96, height: 96, borderRadius: '50%',
                  background: 'var(--stage-chip)',
                  border: '1px solid var(--stage-chip-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 42, fontWeight: 800, color: 'var(--stage-ink)', marginBottom: 18,
                }}
              >
                ?
              </div>
              <p style={{
                color: 'var(--stage-ink)', fontSize: 16, fontWeight: 700, textAlign: 'center', margin: '0 0 8px',
              }}>
                Your partner is explaining a word…
              </p>
              <p style={{
                color: 'var(--stage-ink-soft)', fontSize: 13, fontWeight: 600, textAlign: 'center', margin: 0,
              }}>
                Listen closely and guess
              </p>
              <div className="taboo-dots" aria-hidden="true" style={{ marginTop: 14 }}>
                <span style={{ animationDelay: '0ms' }} />
                <span style={{ animationDelay: '180ms' }} />
                <span style={{ animationDelay: '360ms' }} />
              </div>
            </StageCard>
          )}
        </div>

        {isExplainer ? (
          <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px' }}>
            <button
              onClick={onCorrect}
              style={{
                flex: 1.5, height: 46, borderRadius: 12, border: 'none',
                background: 'var(--accent)', color: 'var(--text-on-accent)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Check size={18} strokeWidth={1.75} aria-hidden="true" /> Correct
            </button>
            <button
              onClick={onPass}
              style={{
                flex: 1, height: 46, borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-input)', color: 'var(--text-secondary)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <SkipForward size={18} strokeWidth={1.75} aria-hidden="true" /> Pass
            </button>
          </div>
        ) : (
          <div style={{ padding: '14px 16px 18px' }}>
            <p style={{
              color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textAlign: 'center', margin: 0,
            }}>
              When you guess it, your partner taps Correct and the turn passes to you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
