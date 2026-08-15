import React from 'react';
import { debateTopics } from '../data/debateTopics';

// In-call synchronized Debate game. Same pattern as Taboo/Suallar: everything
// lives in the call doc's debateStage field, so both peers stay on the same
// topic. The topic itself is shown to BOTH peers (it's what they're actually
// debating), but each peer only ever renders their OWN side's talking points
// — the opponent's `points` array is never mounted on your screen, same trick
// Taboo uses to hide the forbidden words from the guesser.
const PANEL = {
  pointerEvents: 'auto',
  width: '100%',
  maxWidth: 360,
  background: 'var(--bg-card, #17172b)',
  borderRadius: 22,
  border: '1px solid #7c6ff755',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55), 0 0 24px #7c6ff722',
  overflow: 'hidden',
  // Bu panel Taboo-dan xeyli hündürdür: 5 arqument iki sətrə keçəndə 320px
  // ekranda alt düymələr kadrdan çıxırdı və sürüşdürmək mümkün deyildi.
  maxHeight: 'calc(100vh - 32px)',
  display: 'flex',
  flexDirection: 'column',
};

const CARD_BASE = {
  position: 'relative',
  borderRadius: 20,
  padding: '20px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: 'linear-gradient(160deg, #1e1b4b 0%, #2e1065 55%, #172554 100%)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px rgba(0,0,0,0.45), 0 0 26px rgba(124,111,247,0.18)',
};

const FOOT_BTN = {
  flex: 1,
  height: 46,
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const GHOST_BTN = {
  ...FOOT_BTN,
  border: '1px solid var(--border, #2a2947)',
  background: 'var(--bg-input, #14132b)',
  color: 'var(--text-secondary, #a8afc9)',
};

const SOLID_BTN = {
  ...FOOT_BTN,
  border: 'none',
  background: 'linear-gradient(135deg, #7c6ff7, #6355e0)',
  color: '#fff',
  boxShadow: '0 6px 18px rgba(124,111,247,0.28)',
};

export default function CallDebateStage({ topicIndex, side, onNextTopic, onClose }) {
  const topic = debateTopics[topicIndex % debateTopics.length];
  const mine = side === 'B' ? topic.sideB : topic.sideA;
  const theirLabel = side === 'B' ? topic.sideA.label : topic.sideB.label;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      <div style={PANEL}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px 8px', flexShrink: 0,
        }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: 0 }}>
            💬 Debat
          </p>
          <button
            onClick={onClose}
            aria-label="Bağla"
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)',
              fontSize: 20, cursor: 'pointer', padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '0 16px 6px', flexShrink: 0 }}>
          <p style={{
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px', textAlign: 'center',
          }}>
            Mövzu
          </p>
          <p style={{
            color: 'var(--text-primary)', fontSize: 17, fontWeight: 700, lineHeight: 1.4,
            margin: 0, textAlign: 'center',
          }}>
            {topic.topic}
          </p>
        </div>

        {/* Yalnız arqument kartı sürüşür — mövzu başlıqda, düymələr altda sabit
            qalır, yoxsa uzun siyahıda «Bitir» əlçatmaz olurdu. */}
        <div style={{ padding: '10px 16px 0', overflowY: 'auto', minHeight: 0 }}>
          <div key={topicIndex} className="debate-card" style={CARD_BASE}>
            <p style={{
              color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, margin: 0,
              textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'center',
            }}>
              Sizin tərəfiniz
            </p>
            <h3 style={{
              color: '#fff', fontSize: 24, fontWeight: 800, margin: '0 0 4px', textAlign: 'center',
              textShadow: '0 0 22px rgba(139,107,255,0.55)',
            }}>
              {mine.label}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mine.points.map((p) => (
                <div key={p} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 10, padding: '8px 12px',
                  color: '#e7e6fb', fontSize: 13, fontWeight: 500, lineHeight: 1.4,
                }}>
                  <span aria-hidden="true" style={{ color: '#22d3ee', fontWeight: 800 }}>•</span>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p style={{
          color: 'var(--text-muted, #7c84a2)', fontSize: 12, textAlign: 'center',
          margin: '10px 16px 0', flexShrink: 0,
        }}>
          Əks tərəf: <strong>{theirLabel}</strong> — arqumentlərini görmürsünüz, diqqətlə dinləyin! 👂
        </p>

        <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px', flexShrink: 0 }}>
          <button onClick={onClose} style={GHOST_BTN}>✕ Bitir</button>
          <button onClick={onNextTopic} style={SOLID_BTN}>Növbəti mövzu →</button>
        </div>
      </div>
    </div>
  );
}
