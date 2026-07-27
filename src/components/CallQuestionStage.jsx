import React from 'react';

// In-call synchronized speaking cards. Same channel as the picture and Taboo
// stages: everything lives in the call doc's questionStage field, so both peers
// always look at the same screen. Unlike Taboo there is no turn — either side
// may pick the level or move between cards, which is what makes it usable when
// one partner is too shy to drive.
//
// questionStage shape:
//   { active, contentIndex, difficulty: null|'easy'|'hard', cardIndex: number }
// difficulty === null -> level picker; otherwise that card is open for both.
// There is deliberately no deck/overview step: picking a level drops straight
// onto the first card, and finishing the last one closes the stage.

const PANEL = {
  pointerEvents: 'auto',
  width: '100%',
  maxWidth: 360,
  background: 'var(--bg-card, #17172b)',
  borderRadius: 22,
  border: '1px solid #7c6ff755',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55), 0 0 24px #7c6ff722',
  overflow: 'hidden',
};

const LEVEL_BTN = {
  width: '100%',
  height: 76,
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#fff',
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: '0.5px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  textShadow: '0 2px 8px rgba(0,0,0,0.35)',
};

const FOOT_BTN = {
  flex: 1,
  height: 46,
  borderRadius: 12,
  fontSize: 15,
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
};

const LEVEL_CHIP = { easy: 'EASY', hard: 'HARD' };

export default function CallQuestionStage({
  content, difficulty, cardIndex = 0,
  onPickDifficulty, onGo, onBackToDifficulty, onClose,
}) {
  const questions = (difficulty && content?.questions?.[difficulty]) || [];

  const header = (title) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px',
    }}>
      <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: 0 }}>
        {title}
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
  );

  // ── Səviyyə seçimi — kartlar açılmazdan əvvəl ──
  if (!difficulty) {
    return (
      <Overlay>
        {header('🗣️ Sual kartları')}
        <div style={{ padding: '0 16px 20px' }}>
          <p style={{
            color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5,
            margin: '0 0 16px', textAlign: 'center',
          }}>
            {content?.topic ? `${content.topic} — ` : ''}
            səviyyəni seçin, kartlar ikinizə də açılacaq.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => onPickDifficulty('easy')}
              style={{ ...LEVEL_BTN, background: 'linear-gradient(135deg, #22c55e, #15803d)' }}
            >
              <span aria-hidden="true" style={{ fontSize: 26 }}>🟢</span> Easy
            </button>
            <button
              onClick={() => onPickDifficulty('hard')}
              style={{ ...LEVEL_BTN, background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
            >
              <span aria-hidden="true" style={{ fontSize: 26 }}>🔴</span> Hard
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  const safeIndex = Math.min(Math.max(cardIndex, 0), Math.max(questions.length - 1, 0));
  const isFirst = safeIndex === 0;
  const isLast = safeIndex >= questions.length - 1;

  return (
    <Overlay>
      {header('🗣️ Sual kartı')}
      <div style={{ padding: '0 16px' }}>
        <div key={safeIndex} className="qstage-card" style={{
          borderRadius: 20, padding: '26px 20px', minHeight: 210,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16,
          background: 'linear-gradient(160deg, #1e1b4b 0%, #2e1065 55%, #172554 100%)',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px rgba(0,0,0,0.45)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 800,
              letterSpacing: '1.5px',
            }}>
              {safeIndex + 1} / {questions.length}
            </span>
            <span style={{
              background: difficulty === 'easy'
                ? 'linear-gradient(135deg, #22c55e, #15803d)'
                : 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: '#fff', borderRadius: 20, padding: '4px 12px',
              fontSize: 12, fontWeight: 800, letterSpacing: '1px',
            }}>
              {LEVEL_CHIP[difficulty]}
            </span>
          </div>
          <p style={{
            color: '#fff', fontSize: 21, fontWeight: 700, lineHeight: 1.4,
            margin: 0, textShadow: '0 0 22px rgba(139,107,255,0.35)',
          }}>
            {questions[safeIndex]}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '16px' }}>
        {/* Birinci kartda "geri" səviyyə seçiminə qaytarır — dəstə siyahısı yoxdur. */}
        <button
          onClick={() => (isFirst ? onBackToDifficulty() : onGo(safeIndex - 1))}
          style={GHOST_BTN}
        >
          {isFirst ? '← Səviyyə' : '← Əvvəlki'}
        </button>
        <button
          onClick={() => (isLast ? onClose() : onGo(safeIndex + 1))}
          style={isLast
            ? { ...SOLID_BTN, background: 'linear-gradient(135deg, #22c55e, #15803d)' }
            : SOLID_BTN}
        >
          {isLast ? 'Bitir ✓' : 'Növbəti →'}
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      <div style={PANEL}>{children}</div>
    </div>
  );
}
