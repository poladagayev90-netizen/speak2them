import React, { useState } from 'react';

// AI-nin şagirdin ÖZ səhvlərindən qurduğu interaktiv ev tapşırığı.
// Üç blok: test (Duolingo üslubu), söz sırası (toxun-düz), düzəliş müqayisəsi.
// Vəziyyət yalnız lokaldır — məqsəd öyrənmə anıdır, qiymətləndirmə deyil.
// Müəllim panelində də eyni komponent açılır: müəllim şagirdinin hansı
// tapşırıqları alacağını birə-bir görür.

const cardStyle = {
  background: 'var(--bg-secondary)', borderRadius: '16px', padding: '16px',
};

// ─── 1. Test sualı ───────────────────────────────────────────────
function MultipleChoice({ item, index }) {
  const [picked, setPicked] = useState(null);
  const answered = picked !== null;
  const isCorrect = picked === item.correct_answer;

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px' }}>
        Sual {index + 1}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', lineHeight: 1.5 }}>
        {item.question}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {item.options.map((opt) => {
          const isThis = picked === opt;
          const showGreen = answered && opt === item.correct_answer;
          const showRed = answered && isThis && !isCorrect;
          return (
            <button
              key={opt}
              type="button"
              disabled={answered}
              onClick={() => setPicked(opt)}
              style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: '12px',
                fontSize: '14px', fontWeight: 600, cursor: answered ? 'default' : 'pointer',
                border: showGreen ? '2px solid #22c55e' : showRed ? '2px solid #ef4444' : '1px solid var(--border)',
                background: showGreen ? '#22c55e22' : showRed ? '#ef444422' : 'var(--bg-card)',
                color: 'var(--text-primary)',
                transition: 'all .15s ease',
              }}
            >
              {showGreen ? '✅ ' : showRed ? '❌ ' : ''}{opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div style={{
          marginTop: '12px', padding: '12px', borderRadius: '12px',
          background: isCorrect ? '#22c55e15' : 'var(--bg-card)',
          border: `1px solid ${isCorrect ? '#22c55e44' : 'var(--border)'}`,
        }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: isCorrect ? '#16a34a' : 'var(--text-primary)', marginBottom: '4px' }}>
            {isCorrect ? '🎉 Düzdür!' : `Düzgün cavab: ${item.correct_answer}`}
          </div>
          {item.explanation && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              💡 {item.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 2. Söz sırası ───────────────────────────────────────────────
function WordOrder({ item, index }) {
  // Hər söz mənbə massivindəki indeksi ilə izlənir — təkrarlanan sözlər
  // ("the ... the") bir-birinin yerinə işlənə bilsin, açar da stabil qalsın.
  const [chosen, setChosen] = useState([]); // seçilmiş scrambled-indeksləri sırayla
  const [checked, setChecked] = useState(false);

  const target = item.correct_sentence.replace(/[.!?]+$/, '').trim();
  const built = chosen.map((i) => item.scrambled[i]).join(' ');
  const complete = chosen.length === item.scrambled.length;
  const isCorrect = built.toLowerCase() === target.toLowerCase();

  const toggle = (i) => {
    if (checked) return;
    setChosen((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };
  const reset = () => { setChosen([]); setChecked(false); };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px' }}>
        Cümləni qur {index + 1}
      </div>

      {/* Qurulan cümlə */}
      <div style={{
        minHeight: '48px', padding: '10px 12px', borderRadius: '12px',
        border: checked
          ? `2px solid ${isCorrect ? '#22c55e' : '#ef4444'}`
          : '1px dashed var(--border)',
        background: 'var(--bg-card)', marginBottom: '12px',
        display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
      }}>
        {chosen.length === 0 && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sözlərə toxunaraq cümləni qur...</span>
        )}
        {chosen.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            style={{
              padding: '6px 10px', borderRadius: '10px', border: 'none',
              background: 'var(--accent)', color: 'var(--text-on-accent, #fff)',
              fontSize: '14px', fontWeight: 700, cursor: checked ? 'default' : 'pointer',
            }}
          >
            {item.scrambled[i]}
          </button>
        ))}
      </div>

      {/* Söz bankı */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {item.scrambled.map((w, i) => (
          <button
            key={i}
            type="button"
            disabled={chosen.includes(i) || checked}
            onClick={() => toggle(i)}
            style={{
              padding: '6px 10px', borderRadius: '10px',
              border: '1px solid var(--border)',
              background: chosen.includes(i) ? 'transparent' : 'var(--bg-card)',
              color: chosen.includes(i) ? 'transparent' : 'var(--text-primary)',
              fontSize: '14px', fontWeight: 700,
              cursor: chosen.includes(i) || checked ? 'default' : 'pointer',
            }}
          >
            {w}
          </button>
        ))}
      </div>

      {!checked ? (
        <button
          type="button"
          disabled={!complete}
          onClick={() => setChecked(true)}
          style={{
            width: '100%', padding: '11px', borderRadius: '12px', border: 'none',
            background: complete ? 'linear-gradient(135deg, var(--accent), var(--accent-strong))' : 'var(--bg-card)',
            color: complete ? '#fff' : 'var(--text-muted)',
            fontSize: '14px', fontWeight: 800, cursor: complete ? 'pointer' : 'default',
          }}
        >
          Yoxla
        </button>
      ) : (
        <div>
          <div style={{
            padding: '12px', borderRadius: '12px', marginBottom: '8px',
            background: isCorrect ? '#22c55e15' : '#ef444415',
            border: `1px solid ${isCorrect ? '#22c55e44' : '#ef444444'}`,
          }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: isCorrect ? '#16a34a' : '#dc2626', marginBottom: '4px' }}>
              {isCorrect ? '🎉 Mükəmməl!' : 'Düzgün cümlə:'}
            </div>
            {!isCorrect && (
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {item.correct_sentence}
              </div>
            )}
            {item.explanation && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                💡 {item.explanation}
              </div>
            )}
          </div>
          {!isCorrect && (
            <button
              type="button"
              onClick={reset}
              style={{
                width: '100%', padding: '10px', borderRadius: '12px',
                border: '1px solid var(--border)', background: 'none',
                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              🔄 Yenidən yoxla
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 3. Düzəliş müqayisəsi ───────────────────────────────────────
function CorrectionCompare({ item }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: 'var(--danger)', fontSize: '14px', textDecoration: 'line-through', marginBottom: '4px' }}>
        {item.original}
      </div>
      <div style={{ color: 'var(--success)', fontSize: '15px', fontWeight: 700, marginBottom: item.reason ? '8px' : 0 }}>
        {item.corrected}
      </div>
      {item.reason && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', background: 'var(--bg-card)', padding: '10px', borderRadius: '10px', lineHeight: 1.55 }}>
          💡 {item.reason}
        </div>
      )}
    </div>
  );
}

export default function AnalysisHomework({ homework, showCorrections = true }) {
  if (!homework) return null;
  const { multipleChoice = [], wordOrder = [], correction = [] } = homework;
  if (!multipleChoice.length && !wordOrder.length && !(showCorrections && correction.length)) return null;

  const h3 = { color: 'var(--text-primary)', fontSize: 18, fontWeight: 800, marginBottom: 16 };

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #7c6ff722, #5b4de822)',
        border: '1px solid #7c6ff755', borderRadius: '16px',
        padding: '16px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '4px' }}>
          📝 Sənin üçün hazırlanmış tapşırıqlar
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Bu tapşırıqlar məhz bu zəngdəki öz səhvlərindən qurulub — həll et, pattern beyninə otursun.
        </div>
      </div>

      {multipleChoice.length > 0 && (
        <>
          <h3 style={h3}>🎯 Doğru variantı seç</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {multipleChoice.map((q, i) => <MultipleChoice key={i} item={q} index={i} />)}
          </div>
        </>
      )}

      {wordOrder.length > 0 && (
        <>
          <h3 style={h3}>🧩 Sözləri düz</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {wordOrder.map((w, i) => <WordOrder key={i} item={w} index={i} />)}
          </div>
        </>
      )}

      {showCorrections && correction.length > 0 && (
        <>
          <h3 style={h3}>🔍 Müqayisə et və yadda saxla</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {correction.map((c, i) => <CorrectionCompare key={i} item={c} />)}
          </div>
        </>
      )}
    </div>
  );
}
