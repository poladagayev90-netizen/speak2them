import React from 'react';

// In-call synchronized speaking cards. Same channel as the picture and Taboo
// stages: everything lives in the call doc's questionStage field, so both peers
// always look at the same screen — the difficulty picker, the deck, or one open
// card. Unlike Taboo there is no turn: either side may pick, flip or go back,
// which is what makes it usable when one partner is shy about driving.
//
// questionStage shape:
//   { active, contentIndex, difficulty: null|'easy'|'hard', cardIndex: null|number, seen: number[] }
// difficulty === null  -> picker step
// cardIndex  === null  -> deck step
// otherwise            -> that card is open for both

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

const FACE_DOWN = {
  aspectRatio: '1 / 1',
  border: 'none',
  borderRadius: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  background: 'linear-gradient(150deg, #2e1065 0%, #4c1d95 55%, #172554 100%)',
  color: '#fff',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 16px rgba(0,0,0,0.35)',
};

const SEEN_DOWN = {
  ...FACE_DOWN,
  background: 'var(--bg-input, #14132b)',
  color: 'var(--text-muted, #7c84a2)',
  boxShadow: 'none',
  border: '1px solid var(--border, #2a2947)',
};

const FOOT_BTN = {
  flex: 1,
  height: 44,
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
};

const DIFF_LABEL = { easy: '🟢 Asan', hard: '🔴 Çətin' };

export default function CallQuestionStage({
  content, difficulty, cardIndex, seen = [],
  onPickDifficulty, onOpenCard, onBackToDeck, onBackToDifficulty, onClose,
}) {
  const questions = (difficulty && content?.questions?.[difficulty]) || [];

  const header = (title) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 16px',
    }}>
      <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: 0 }}>
        {title}
      </p>
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
  );

  let body;

  // ── 1. Səviyyə seçimi — kartlar açılmazdan əvvəl ──
  if (!difficulty) {
    body = (
      <>
        {header('🗣️ Sual kartları')}
        <div style={{ padding: '0 16px 18px' }}>
          <p style={{
            color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5,
            margin: '0 0 14px', textAlign: 'center',
          }}>
            {content?.topic ? `${content.topic} — ` : ''}
            səviyyəni seçin, kartlar ikinizə də eyni anda açılacaq.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => onPickDifficulty('easy')} style={{
              ...SOLID_BTN, height: 56,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            }}>
              🟢 Asan suallar
            </button>
            <button onClick={() => onPickDifficulty('hard')} style={{
              ...SOLID_BTN, height: 56,
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            }}>
              🔴 Çətin suallar
            </button>
          </div>
        </div>
      </>
    );

  // ── 3. Açıq kart — bir sual, hər ikisi görür ──
  } else if (cardIndex != null && questions[cardIndex]) {
    const isLast = cardIndex >= questions.length - 1;
    body = (
      <>
        {header('🗣️ Sual kartı')}
        <div style={{ padding: '0 16px' }}>
          <div style={{
            position: 'relative', borderRadius: 20, padding: '26px 20px', minHeight: 200,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14,
            background: 'linear-gradient(160deg, #1e1b4b 0%, #2e1065 55%, #172554 100%)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px rgba(0,0,0,0.45)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{
                color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700,
                letterSpacing: '1.5px',
              }}>
                {cardIndex + 1} / {questions.length}
              </span>
              <span style={{
                background: 'rgba(255,255,255,0.12)', color: '#fff',
                borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
              }}>
                {DIFF_LABEL[difficulty]}
              </span>
            </div>
            <p style={{
              color: '#fff', fontSize: 20, fontWeight: 700, lineHeight: 1.4,
              margin: 0, textShadow: '0 0 22px rgba(139,107,255,0.35)',
            }}>
              {questions[cardIndex]}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px' }}>
          <button onClick={onBackToDeck} style={GHOST_BTN}>← Kartlar</button>
          {!isLast && (
            <button onClick={() => onOpenCard(cardIndex + 1)} style={SOLID_BTN}>
              Növbəti →
            </button>
          )}
        </div>
      </>
    );

  // ── 2. Kart dəstəsi ──
  } else {
    body = (
      <>
        {header(`🗣️ ${DIFF_LABEL[difficulty]} · ${questions.length} kart`)}
        <div style={{ padding: '0 16px 4px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          }}>
            {questions.map((q, i) => {
              const isSeen = seen.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => onOpenCard(i)}
                  aria-label={`${i + 1}-ci sual kartı`}
                  style={isSeen ? SEEN_DOWN : FACE_DOWN}
                >
                  <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>{isSeen ? '✓' : '?'}</span>
                </button>
              );
            })}
          </div>
          <p style={{
            color: 'var(--text-muted, #7c84a2)', fontSize: 12, textAlign: 'center',
            margin: '12px 0 0',
          }}>
            Hər ikiniz kart aça və geri qayıda bilərsiniz.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px 16px' }}>
          <button onClick={onBackToDifficulty} style={GHOST_BTN}>← Səviyyə</button>
        </div>
      </>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', pointerEvents: 'none',
    }}>
      <div style={PANEL}>{body}</div>
    </div>
  );
}
