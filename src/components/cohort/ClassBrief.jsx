import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { authedFetch } from '../../api';
import { FUNCTIONS_BASE } from '../../constants';
import { weeklyContent } from '../../data/weeklyContent';
import Sheet from '../ui/Sheet';
import './cohort.css';

const day = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', day: 'numeric', month: 'short' }).format(new Date(ms));

// Before a lesson: what the class got wrong in its own calls since the last
// lesson, the words it kept reaching for, and who did that lesson's homework.
// Counted on the server (teacherClassBrief); fetched each time it is opened so
// it is never stale.
export default function ClassBrief({ cohortId }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setOpen(true); setError(''); setBrief(null);
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/teacherClassBrief`, {
        method: 'POST', body: JSON.stringify({ cohortId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'failed');
      setBrief(data);
    } catch {
      setError('Could not load the brief. Try again.');
    }
  };

  const last = brief?.lastLesson;
  const lastTopic = last && Number.isInteger(last.topicIndex) ? weeklyContent[last.topicIndex]?.topic : null;

  return (
    <>
      <button type="button" className="cb-open" onClick={load}>
        <ClipboardList size={16} aria-hidden="true" />
        Class brief
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Before the next lesson">
        {error && <p className="cc-error" role="alert">{error}</p>}
        {!brief && !error && <p className="cb-muted">Counting the class's calls…</p>}
        {brief && (
          <div className="cb">
            <p className="cb-muted">
              {last ? `Calls since lesson ${last.n} (${day(brief.sinceMs)})` : `Calls since ${day(brief.sinceMs)}`}
              {' · '}{brief.withCalls} of {brief.members} learners practised
            </p>
            <p className="cb-focus">{brief.focus}</p>

            {brief.themes.length > 0 && (
              <section className="cb-sec">
                <h3 className="cb-h">What the class keeps getting wrong</h3>
                {brief.themes.map((t) => (
                  <div key={t.concept} className="cb-theme">
                    <div className="cb-theme-top">
                      <span className="cb-theme-label">{t.label}</span>
                      <span className="cb-count">{t.students} {t.students === 1 ? 'learner' : 'learners'} · {t.mistakes}×</span>
                    </div>
                    {t.examples.map((e, i) => (
                      <p key={i} className="cb-ex"><b>{e.name}:</b> <s>{e.original}</s> → {e.corrected}</p>
                    ))}
                  </div>
                ))}
              </section>
            )}

            {brief.words.length > 0 && (
              <section className="cb-sec">
                <h3 className="cb-h">Words they reached for</h3>
                <div className="cb-words">
                  {brief.words.map((w) => (
                    <span key={w.word} className="cb-word">{w.word}{w.students > 1 && <b> ×{w.students}</b>}</span>
                  ))}
                </div>
              </section>
            )}

            <section className="cb-sec">
              <h3 className="cb-h">{last ? `Homework · lesson ${last.n}${lastTopic ? ` · ${lastTopic}` : ''}` : 'Homework'}</h3>
              {!last && <p className="cb-muted">No lesson is marked held yet, so there is no homework.</p>}
              {last && brief.students.map((s) => {
                const h = s.homework;
                const pct = h ? Math.round((h.done / h.total) * 100) : 0;
                return (
                  <div key={s.uid} className="cb-stu">
                    <div className="cb-stu-top">
                      <span className="cb-stu-name">{s.name}</span>
                      <span className="cb-stu-state">
                        {!h ? 'not opened' : h.done === h.total ? 'done' : `${h.done}/${h.total} steps`}
                        {h && h.dictation != null && ` · dictation ${h.dictation}%`}
                      </span>
                    </div>
                    <div className="cb-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                    <p className="cb-stu-calls">{s.calls} {s.calls === 1 ? 'call' : 'calls'} since the lesson</p>
                  </div>
                );
              })}
            </section>
          </div>
        )}
      </Sheet>
    </>
  );
}
