import React, { useState, useEffect } from 'react';

// Wordwall tipli "speaking card" lövhəsi: suallar üzüaşağı kartlar kimi düzülür,
// kartın üstünə toxunanda açılır və sual tam görünür. Eyni anda yalnız bir kart
// açıq qalır — danışan adam bir suala fokuslanmalıdır, siyahını gözü ilə
// süzməməlidir. Açılmış kartlar ✓ ilə işarələnir ki, hansılardan keçdiyin bilinsin.
export default function SpeakingCards({ questions = [] }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [seen, setSeen] = useState({});

  // Asan/çətin keçidi (və ya yeni mövzu) yeni massiv gətirir — köhnə açıq kart
  // orada qalsa, 3-cü kartın altında tamam başqa sual görünərdi.
  useEffect(() => {
    setOpenIndex(null);
    setSeen({});
  }, [questions]);

  const toggle = (i) => {
    setOpenIndex((prev) => (prev === i ? null : i));
    setSeen((prev) => ({ ...prev, [i]: true }));
  };

  if (!questions.length) return null;

  return (
    <div className="sc-grid">
      {questions.map((q, i) => {
        const isOpen = openIndex === i;
        return (
          <button
            key={i}
            type="button"
            aria-expanded={isOpen}
            className={`sc-card${isOpen ? ' open' : ''}${seen[i] && !isOpen ? ' seen' : ''}`}
            onClick={() => toggle(i)}
          >
            {isOpen ? (
              <span className="sc-body">
                <span className="sc-body-num">{i + 1}</span>
                <span className="sc-question">{q}</span>
                <span className="sc-hint">Bağlamaq üçün toxun</span>
              </span>
            ) : (
              <span className="sc-face">
                <span className="sc-num">{i + 1}</span>
                <span className="sc-mark">{seen[i] ? '✓' : '?'}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
