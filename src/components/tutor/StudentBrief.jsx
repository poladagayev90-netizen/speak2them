import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { authedFetch } from '../../api';
import { FUNCTIONS_BASE } from '../../constants';
import { weeklyContent } from '../../data/weeklyContent';
import { plainTopic } from '../../utils/topicLabel';
import Sheet from '../ui/Sheet';
import '../cohort/cohort.css';

const day = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', day: 'numeric', month: 'short' }).format(new Date(ms));

// Before a lesson: what this student got wrong in their own calls since the
// last lesson, the words they kept reaching for, and how far that lesson's
// homework got. Counted on the server (teacherStudentBrief); fetched each time
// it is opened so it is never stale.
export default function StudentBrief({ uid, name }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setOpen(true); setError(''); setBrief(null);
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/teacherStudentBrief`, {
        method: 'POST', body: JSON.stringify({ uid }),
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
  const h = brief?.homework;

  return (
    <>
      <button type="button" className="cb-open" onClick={load}>
        <ClipboardList size={16} aria-hidden="true" />
        Before the lesson
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Before the lesson${name ? ` · ${name}` : ''}`}>
        {error && <p className="cc-error" role="alert">{error}</p>}
        {!brief && !error && <p className="cb-muted">Reading their calls…</p>}
        {brief && (
          <div className="cb">
            <p className="cb-muted">
              {last ? `Since lesson ${last.n} (${day(brief.sinceMs)})` : `Since ${day(brief.sinceMs)}`}
              {' · '}{brief.calls} {brief.calls === 1 ? 'analysed call' : 'analysed calls'}
            </p>
            <p className="cb-focus">{brief.focus}</p>

            {brief.themes.length > 0 && (
              <section className="cb-sec">
                <h3 className="cb-h">What they keep getting wrong</h3>
                {brief.themes.map((t) => (
                  <div key={t.concept} className="cb-theme">
                    <div className="cb-theme-top">
                      <span className="cb-theme-label">{t.label}</span>
                      <span className="cb-count">{t.mistakes}×</span>
                    </div>
                    {t.examples.map((e, i) => (
                      <p key={i} className="cb-ex"><s>{e.original}</s> → {e.corrected}</p>
                    ))}
                  </div>
                ))}
              </section>
            )}

            {brief.words.length > 0 && (
              <section className="cb-sec">
                <h3 className="cb-h">Words they reached for</h3>
                <div className="cb-words">
                  {brief.words.map((w) => <span key={w} className="cb-word">{w}</span>)}
                </div>
              </section>
            )}

            <section className="cb-sec">
              <h3 className="cb-h">{last ? `Homework · lesson ${last.n}${lastTopic ? ` · ${plainTopic(lastTopic)}` : ''}` : 'Homework'}</h3>
              {!last && <p className="cb-muted">No lesson is marked held yet, so there is no homework.</p>}
              {last && (
                <div className="cb-stu">
                  <div className="cb-stu-top">
                    <span className="cb-stu-name">{!h ? 'Not opened' : h.done === h.total ? 'Done' : `${h.done} of ${h.total} steps`}</span>
                    {h && h.dictation != null && <span className="cb-stu-state">dictation {h.dictation}%</span>}
                  </div>
                  <div className="cb-bar" aria-hidden="true"><span style={{ width: `${h ? Math.round((h.done / h.total) * 100) : 0}%` }} /></div>
                </div>
              )}
            </section>
          </div>
        )}
      </Sheet>
    </>
  );
}
