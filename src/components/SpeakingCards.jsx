import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Shuffle, Check } from 'lucide-react';

// The topic's speaking questions as a STAGE: one question at a time, as the
// biggest thing on the screen, with arrows, a «Random» pick and a strip of
// numbers underneath.
//
// Why not the old Wordwall grid (2026-11-17, Polad): the teacher SHARES this
// sheet in a lesson. In the grid the open question was one line of body text
// in a wide white box and the numbered tiles sat far below it — on a shared
// screen the student saw mostly empty tiles. Now the question is slide-sized,
// like a clip in ClipViewer, and the strip still shows which ones were asked.
//
// The first question is open from the start: a face-down board made the
// teacher tap before anything was readable.
export default function SpeakingCards({ questions = [] }) {
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState({ 0: true });

  // Easy/hard (or a new topic) brings a new array — start it from the top,
  // or question 3 of the old list would point at a different question.
  useEffect(() => {
    setI(0);
    setSeen({ 0: true });
  }, [questions]);

  const n = questions.length;
  const goTo = useCallback((next) => {
    setI(next);
    setSeen((prev) => ({ ...prev, [next]: true }));
  }, []);
  const step = useCallback((d) => goTo((i + d + n) % n), [goTo, i, n]);

  // A question nobody has been asked yet; when all have been, any other one.
  const random = () => {
    if (n < 2) return;
    const fresh = questions.map((_, k) => k).filter((k) => k !== i && !seen[k]);
    const pool = fresh.length ? fresh : questions.map((_, k) => k).filter((k) => k !== i);
    goTo(pool[Math.floor(Math.random() * pool.length)]);
  };

  // A teacher sharing a laptop screen changes questions with the arrow keys,
  // as in ClipViewer — never while typing somewhere.
  useEffect(() => {
    if (n < 2) return undefined;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target?.isContentEditable) return;
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, step]);

  if (!n) return null;
  const asked = Object.keys(seen).length;

  return (
    <div className="sq">
      {/* key={i}: a new question re-runs the entrance, so the change is seen
          on the other side of a screen share too. */}
      <div className="sq-stage" key={i} aria-live="polite">
        <span className="sq-count">Question {i + 1} of {n}</span>
        <p className="sq-question">{questions[i]}</p>
      </div>

      <div className="sq-nav">
        <button type="button" className="sq-arrow" onClick={() => step(-1)} aria-label="Previous question" disabled={n < 2}>
          <ChevronLeft size={22} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <button type="button" className="sq-random" onClick={random} disabled={n < 2}>
          <Shuffle size={18} strokeWidth={2.25} aria-hidden="true" /> Random question
        </button>
        <button type="button" className="sq-arrow" onClick={() => step(1)} aria-label="Next question" disabled={n < 2}>
          <ChevronRight size={22} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      <div className="sq-strip" role="group" aria-label={`${asked} of ${n} asked`}>
        {questions.map((q, k) => (
          <button
            key={k}
            type="button"
            className={`sq-dot${k === i ? ' current' : ''}${seen[k] && k !== i ? ' seen' : ''}`}
            onClick={() => goTo(k)}
            aria-label={`Question ${k + 1}${seen[k] ? ', asked' : ''}`}
            aria-current={k === i ? 'true' : undefined}
          >
            {seen[k] && k !== i ? <Check size={14} strokeWidth={2.75} aria-hidden="true" /> : k + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
