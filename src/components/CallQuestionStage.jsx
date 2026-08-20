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

// Səviyyə rəngləri brend palitrasındandır, svetofor yaşıl/qırmızısı DEYİL.
// Əvvəl Easy tam doymuş yaşıl, Hard tam doymuş qırmızı gradient idi (76px
// hündürlük, 24px şrift, 26px emoji dairə) — ucuz görünürdü və «qırmızı = səhv»
// assosiasiyası yaradırdı, halbuki Hard səhv deyil, sadəcə daha ağır seçimdir.
const LEVEL_ACCENT = {
  easy: '#12BBD6',  // Neon Cyan
  hard: '#6D3BEB',  // Lab Violet
};

const LEVEL_CARD = {
  flex: 1,
  minWidth: 0,
  padding: '14px 12px 16px',
  borderRadius: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  transition: 'border-color 0.15s, background 0.15s',
};

// Çətinliyi YALNIZ rənglə göstərmirik — iki zolaqdan neçəsinin dolu olduğu
// rəng görməyən istifadəçi üçün də oxunur.
function LevelBars({ level, colour }) {
  return (
    <span style={{ display: 'flex', gap: 3 }} aria-hidden="true">
      {[0, 1].map((i) => (
        <span key={i} style={{
          width: 16, height: 4, borderRadius: 2,
          background: (level === 'hard' || i === 0) ? colour : 'var(--border)',
        }} />
      ))}
    </span>
  );
}

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
        aria-label="Close"
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
        {header('🗣️ Question cards')}
        <div style={{ padding: '0 16px 20px' }}>
          <p style={{
            color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5,
            margin: '0 0 16px', textAlign: 'center',
          }}>
            {content?.topic ? `${content.topic} — ` : ''}
            pick a level and the cards open for both of you.
          </p>
          {/* Yan-yana iki kart: hər biri 76px-lik tam enli düymədən kiçikdir,
              amma adı + bir sətirlik izahı daşıdığı üçün seçim daha aydındır. */}
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { key: 'easy', name: 'Easy', hint: 'Everyday questions' },
              { key: 'hard', name: 'Hard', hint: 'Deeper discussion' },
            ].map(({ key, name, hint }) => (
              <button
                key={key}
                onClick={() => onPickDifficulty(key)}
                style={LEVEL_CARD}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = LEVEL_ACCENT[key]; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <LevelBars level={key} colour={LEVEL_ACCENT[key]} />
                <span style={{
                  color: 'var(--text-primary)', fontSize: 16, fontWeight: 700,
                  letterSpacing: '0.2px',
                }}>
                  {name}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 }}>
                  {hint}
                </span>
              </button>
            ))}
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
      {header('🗣️ Question card')}
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
              // Seçim ekranındakı ilə eyni brend rəngi — nişan orada seçilən
              // səviyyəni təkrarlayır, ona görə rəng də təkrarlanmalıdır.
              background: LEVEL_ACCENT[difficulty],
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
          {isFirst ? '← Level' : '← Previous'}
        </button>
        <button
          onClick={() => (isLast ? onClose() : onGo(safeIndex + 1))}
          style={isLast
            ? { ...SOLID_BTN, background: 'linear-gradient(135deg, #22c55e, #15803d)' }
            : SOLID_BTN}
        >
          {isLast ? 'Bitir ✓' : 'Next →'}
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
