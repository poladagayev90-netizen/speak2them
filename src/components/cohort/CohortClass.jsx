import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Check } from 'lucide-react';
import { db } from '../../firebase';
import { authedFetch } from '../../api';
import { FUNCTIONS_BASE } from '../../constants';
import { weeklyContent } from '../../data/weeklyContent';
import { lessonSummary } from '../../utils/cohortLessons';
import './cohort.css';

const when = (ms) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Baku', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(ms));

// The teacher's (and the admin's) view of one class: every lesson with its
// date, the topic picked for it and whether it was held. Marking a lesson held
// is what opens its homework, so it needs a topic first (the server refuses
// otherwise). Writes go through the teacherLesson function.
export default function CohortClass({ cohort }) {
  const [lessons, setLessons] = useState([]);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(
    collection(db, 'cohorts', cohort.id, 'lessons'),
    (snap) => setLessons(snap.docs.map((d) => d.data())),
    (e) => console.error('[CohortClass] lessons', e)
  ), [cohort.id]);

  const summary = useMemo(() => lessonSummary(cohort, lessons), [cohort, lessons]);
  if (!summary) {
    return <p className="cc-empty">No class schedule yet — set lessons, days and time first.</p>;
  }

  const send = async (n, payload) => {
    setBusy(n); setError('');
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/teacherLesson`, {
        method: 'POST', body: JSON.stringify({ cohortId: cohort.id, n, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === 'topic_required'
          ? `Pick a topic for lesson ${n} before marking it held.`
          : 'Could not save. Try again.');
      }
    } catch {
      setError('Could not save. Check the connection.');
    }
    setBusy(0);
  };

  return (
    <div className="cc">
      <div className="cc-head">
        <span className="cc-count">{summary.held}/{summary.total} lessons held</span>
        {summary.next && <span className="cc-next">Next: lesson {summary.next.n} · {when(summary.next.startMs)}</span>}
        {summary.ended && <span className="cc-next">The class has ended</span>}
      </div>
      {error && <p className="cc-error" role="alert">{error}</p>}
      <ol className="cc-list">
        {summary.lessons.map((l) => {
          const held = l.status === 'held';
          const isNext = summary.next && summary.next.n === l.n;
          return (
            <li key={l.n} className={`cc-row${held ? ' cc-row--held' : ''}${isNext ? ' cc-row--next' : ''}`}>
              <div className="cc-when">
                <span className="cc-n">{l.n}</span>
                <span className="cc-date">{when(l.startMs)}</span>
              </div>
              <select
                className="cc-topic"
                aria-label={`Topic of lesson ${l.n}`}
                value={Number.isInteger(l.topicIndex) ? String(l.topicIndex) : ''}
                disabled={busy === l.n}
                onChange={(e) => e.target.value !== '' && send(l.n, { action: 'topic', topicIndex: Number(e.target.value) })}
              >
                <option value="">Pick a topic…</option>
                {weeklyContent.map((t, i) => (
                  <option key={i} value={String(i)}>{i + 1}. {t.topic}</option>
                ))}
              </select>
              <button
                type="button"
                className={`cc-held${held ? ' cc-held--on' : ''}`}
                aria-pressed={held}
                disabled={busy === l.n}
                onClick={() => send(l.n, { action: 'held', held: !held })}
              >
                {held && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                {held ? 'Held' : 'Mark held'}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
