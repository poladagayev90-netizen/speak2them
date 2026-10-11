import React, { useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';

// The skill each question trains, so a teacher (and the learner) can see that
// the set goes from the main idea to details to reading between the lines.
const TYPE_LABEL = { gist: 'Main idea', detail: 'Detail', tf: 'True, false or not said', vocab: 'Words in context', inference: 'Between the lines' };

// Comprehension questions after a listening or a reading. One tap answers; the
// right option and the reason (`why`, quoting the text) show straight away.
// Nothing is stored — this is practice, not a test.
export default function MaterialQuestions({ questions, title = 'Check your understanding' }) {
  const [picked, setPicked] = useState({});
  if (!questions?.length) return null;
  const answered = Object.keys(picked).length;
  const right = questions.filter((q, i) => picked[i] === q.answer).length;
  const done = answered === questions.length;

  return (
    <section className="mt-questions" aria-label={title}>
      <div className="mt-questions-head">
        <h3 className="mt-h3">{title}</h3>
        <span className="mt-count">{answered}/{questions.length}</span>
      </div>
      {questions.map((q, i) => {
        const p = picked[i];
        return (
          <div key={i} className="mt-q">
            {TYPE_LABEL[q.type] && <p className="mt-q-type">{TYPE_LABEL[q.type]}</p>}
            <p className="mt-q-text"><span className="mt-q-n">{i + 1}</span>{q.q}</p>
            <div className="mt-q-opts">
              {q.options.map((o, oi) => {
                const state = p == null ? '' : oi === q.answer ? ' is-right' : oi === p ? ' is-wrong' : ' is-dim';
                return (
                  <button key={oi} type="button" disabled={p != null} className={`mt-opt${state}`}
                    onClick={() => setPicked((m) => ({ ...m, [i]: oi }))}>
                    <span>{o}</span>
                    {p != null && oi === q.answer && <Check size={16} aria-label="Right answer" />}
                    {p === oi && oi !== q.answer && <X size={16} aria-label="Your answer" />}
                  </button>
                );
              })}
            </div>
            {p != null && q.why && <p className="mt-why">{q.why}</p>}
          </div>
        );
      })}
      {done && (
        <div className="mt-result">
          <p className="mt-result-score">{right} / {questions.length}</p>
          <p className="mt-result-text">
            {right === questions.length ? 'Every one right.' : right >= questions.length - 1 ? 'Nearly all right.' : 'Listen or read once more and try again.'}
          </p>
          <button type="button" className="mt-ghost" onClick={() => setPicked({})}>
            <RotateCcw size={16} /> Try again
          </button>
        </div>
      )}
    </section>
  );
}
