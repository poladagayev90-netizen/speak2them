import React, { useState } from 'react';
import { keywordGlossary } from '../data/keywordGlossary';
import { getFeedbackLanguage } from '../utils/feedbackLanguage';

// The words under a picture, with their meaning one tap away.
//
// The list tells a learner what to talk about, but at A2 the word itself can be
// the obstacle: "jetty", "masking tape", "shelter". Tapping a chip swaps it for
// the learner's own language and tapping again brings the English back, so the
// English stays the default and the translation is a deliberate act rather than
// a crutch sitting on screen.
//
// LANGUAGE: users.preferredLanguage (az/tr) — the same setting the analysis
// report uses. NOT the phone's system language: a learner with a Russian or
// English phone would then never see a translation at all, and the app's own
// interface is English by design, so the device language says nothing about
// which language they think in.
//
// A chip with no translation is still shown, just not tappable — a missing
// glossary entry must never remove a word the learner is supposed to use.
export default function KeywordChips({
  words,
  label,
  lang = getFeedbackLanguage(),
  style,
  labelStyle,
}) {
  const [open, setOpen] = useState(() => new Set());
  const list = (Array.isArray(words) ? words : [])
    .map((w) => (w && w.word ? w.word : w))
    .filter((w) => typeof w === 'string' && w.trim());

  if (!list.length) return null;

  const translationFor = (word) => {
    const entry = keywordGlossary[String(word).trim().toLowerCase()];
    return entry ? entry[lang] || entry.az || entry.tr || '' : '';
  };

  const toggle = (i) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <div style={style}>
      {label && (
        <p style={{
          color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
          margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px',
          ...labelStyle,
        }}>
          {label}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map((word, i) => {
          const translation = translationFor(word);
          const showing = open.has(i) && translation;
          return (
            <button
              key={`${word}-${i}`}
              type="button"
              onClick={translation ? () => toggle(i) : undefined}
              aria-label={translation ? `${word} — tap for translation` : word}
              style={{
                background: showing ? 'var(--bg-secondary)' : 'var(--accent)',
                color: showing ? 'var(--text-primary)' : 'var(--text-on-accent)',
                border: showing ? '1px solid var(--accent)' : '1px solid transparent',
                borderRadius: 20,
                padding: '5px 14px',
                fontSize: 13,
                fontWeight: 600,
                font: 'inherit',
                fontFamily: 'inherit',
                cursor: translation ? 'pointer' : 'default',
                // The tap target must not move when the label changes length,
                // or the next tap lands on the neighbouring chip.
                minHeight: 30,
              }}
            >
              {showing ? translation : word}
            </button>
          );
        })}
      </div>
    </div>
  );
}
