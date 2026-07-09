import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tabooWords } from '../data/tabooWords';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CONFETTI_COLORS = ['#f59e0b', '#7c6ff7', '#22d3ee', '#ef4444', '#22c55e', '#fb923c'];

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
  background: 'linear-gradient(160deg, #1e1b4b 0%, #2e1065 55%, #172554 100%)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px rgba(0,0,0,0.45), 0 0 26px rgba(124,111,247,0.18)',
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
    setToast(isExplainer ? 'Növbə səndədir! 🎤' : 'Partnyorun izah edir 👂');
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [isExplainer]);

  const confetti = useMemo(() => (burstKey ? makeConfetti() : []), [burstKey]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto', width: '100%', maxWidth: 360, position: 'relative',
        background: 'var(--bg-card, #17172b)',
        borderRadius: 22, border: '1px solid #7c6ff755',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55), 0 0 24px #7c6ff722',
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
            🎭 Taboo
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              key={score}
              className={reduceMotion ? undefined : 'taboo-score-pop'}
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
                borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700,
              }}
            >
              Hesab: {score}
            </span>
            <button
              onClick={onClose}
              aria-label="Bağla"
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                fontSize: 18, cursor: 'pointer', padding: '2px 6px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {toast && (
          <div
            className={reduceMotion ? undefined : 'taboo-toast'}
            style={{
              margin: '0 16px 10px', padding: '8px 12px', borderRadius: 12,
              background: 'var(--accent-soft, rgba(139,107,255,0.16))',
              border: '1px solid #7c6ff755',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}
          >
            {toast}
          </div>
        )}

        <div style={{ padding: '0 16px' }}>
          {isExplainer ? (
            <div key={cardIndex} className="taboo-card" style={CARD_BASE}>
              <p style={{
                color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, margin: '0 0 10px',
                textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'center',
              }}>
                Bu sözü izah et
              </p>
              <h2 style={{
                color: '#fff', fontSize: 34, fontWeight: 800, letterSpacing: '2px',
                textAlign: 'center', margin: '0 0 16px',
                textShadow: '0 0 22px rgba(139,107,255,0.55)',
              }}>
                {card.word}
              </h2>

              <div style={{
                height: 1, margin: '0 0 14px',
                background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)',
              }} />

              <p style={{
                color: '#ef4444', fontSize: 10, fontWeight: 700, margin: '0 0 10px',
                textTransform: 'uppercase', letterSpacing: '1.2px', textAlign: 'center',
              }}>
                Qadağan sözlər
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {card.forbidden.map((w) => (
                  <div key={w} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(239, 68, 68, 0.10)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 10, padding: '7px 12px',
                    color: '#fca5a5', fontSize: 14, fontWeight: 600,
                  }}>
                    <span aria-hidden="true" style={{ color: '#ef4444', fontWeight: 800 }}>✕</span>
                    {w}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div key={cardIndex} className="taboo-card" style={{ ...CARD_BASE, alignItems: 'center' }}>
              <div
                className={reduceMotion ? undefined : 'taboo-orb'}
                aria-hidden="true"
                style={{
                  width: 96, height: 96, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c6ff7, #6355e0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 42, fontWeight: 800, color: '#fff', marginBottom: 18,
                }}
              >
                ?
              </div>
              <p style={{
                color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center', margin: '0 0 8px',
              }}>
                Partnyorunuz sizə bir söz izah edir…
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', margin: 0,
              }}>
                Diqqətlə dinləyin və tapın! 👂
              </p>
              <div className="taboo-dots" aria-hidden="true" style={{ marginTop: 14 }}>
                <span style={{ animationDelay: '0ms' }} />
                <span style={{ animationDelay: '180ms' }} />
                <span style={{ animationDelay: '360ms' }} />
              </div>
            </div>
          )}
        </div>

        {isExplainer ? (
          <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px' }}>
            <button
              onClick={onCorrect}
              style={{
                flex: 1.5, height: 46, borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(34, 197, 94, 0.28)',
              }}
            >
              ✅ Düzgün!
            </button>
            <button
              onClick={onPass}
              style={{
                flex: 1, height: 46, borderRadius: 12,
                border: '1px solid var(--border, #2a2947)',
                background: 'var(--bg-input, #14132b)', color: 'var(--text-secondary)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              ⏭ Pas
            </button>
          </div>
        ) : (
          <div style={{ padding: '14px 16px 18px' }}>
            <p style={{
              color: 'var(--text-muted, #7c84a2)', fontSize: 12, textAlign: 'center', margin: 0,
            }}>
              Tapdıqda partnyorunuz «Düzgün» düyməsinə basacaq və növbə sizə keçəcək.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
