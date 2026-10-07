import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CalendarPlus, Check, Plus } from 'lucide-react';
import { db } from '../../firebase';
import { authedFetch } from '../../api';
import { ADMIN_UID, FUNCTIONS_BASE } from '../../constants';
import { weeklyContent } from '../../data/weeklyContent';
import { atMs, byDate, episodeFor, lessonWhen, nextLesson, packageSummary, PLATFORM_LABEL } from '../../utils/tutorLessons';
import { bakuDateStr } from '../../utils/sessionSchedule';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import '../cohort/cohort.css';
import StoryButton from '../cohort/StoryButton';
import StudentBrief from './StudentBrief';

// Monday first, as a teacher reads a week; values are Baku weekdays (0 = Sun).
const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const BAKU = 'Asia/Baku';
const bakuTime = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: BAKU, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));

const ERRORS = {
  forbidden: 'This student is not linked to you.',
  not_started: 'Start lessons for this student first.',
  no_dates: 'No new lesson times — they are in the past or already planned.',
  too_many: 'Too many planned lessons. Hold or remove some first.',
  topic_required: 'Pick a topic before marking the lesson held.',
  not_yet: 'This lesson has not started yet.',
  not_planned: 'Only a planned lesson can be changed.',
  bad_time: 'Set a date and a time.',
  bad_level: 'Pick a level.',
  bad_package: 'The package must be 1–200 lessons.',
};

export async function tutorCall(payload) {
  try {
    const res = await authedFetch(`${FUNCTIONS_BASE}/teacherLesson`, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: ERRORS[data.error] || 'Could not save. Try again.' };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check the connection.' };
  }
}

function EnrolForm({ uid, enrolment, onDone }) {
  const [level, setLevel] = useState(enrolment?.level || 'B1');
  const [size, setSize] = useState(String(enrolment?.packageSize || 8));
  const [platform, setPlatform] = useState(enrolment?.platform || 'preply');
  const [link, setLink] = useState(enrolment?.link || '');
  const [state, setState] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setState('saving');
    const r = await tutorCall({
      action: enrolment ? 'update' : 'start', uid, level, packageSize: Number(size), platform, link,
      ...(enrolment && enrolment.active === false ? { active: true } : {}),
    });
    setState(r.ok ? '' : r.error);
    if (r.ok) onDone();
  };

  return (
    <form className="cs" onSubmit={save}>
      <div className="cs-row">
        <label className="cs-field">
          <span>Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="A2">A2+</option>
            <option value="B1">B1</option>
          </select>
        </label>
        <label className="cs-field">
          <span>Package</span>
          <input type="number" min="1" max="200" value={size} onChange={(e) => setSize(e.target.value)} />
        </label>
        <label className="cs-field">
          <span>Where</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="preply">Preply</option>
            <option value="meet">Google Meet</option>
          </select>
        </label>
      </div>
      {platform === 'meet' && (
        <label className="cs-field">
          <span>Meet link (optional)</span>
          <input type="url" inputMode="url" placeholder="https://meet.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
      )}
      <Button type="submit" size="sm" full disabled={state === 'saving'}>
        {enrolment ? 'Save' : 'Start lessons'}
      </Button>
      {state && state !== 'saving' && <p className="cc-error" role="alert">{state}</p>}
    </form>
  );
}

function PlanForm({ uid, defaultCount, onDone }) {
  const [days, setDays] = useState([2, 4]);
  const [time, setTime] = useState('19:00');
  const [from, setFrom] = useState(bakuDateStr());
  const [count, setCount] = useState(String(Math.max(1, defaultCount)));
  const [state, setState] = useState('');
  const toggle = (d) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const save = async (e) => {
    e.preventDefault();
    if (days.length === 0) { setState('Pick at least one day.'); return; }
    setState('saving');
    const r = await tutorCall({ action: 'plan', uid, days, time, from, count: Number(count) });
    setState(r.ok ? '' : r.error);
    if (r.ok) onDone();
  };

  return (
    <form className="cs" onSubmit={save}>
      <div className="cs-days" role="group" aria-label="Lesson days">
        {DAYS.map(([d, label]) => (
          <button key={d} type="button" aria-pressed={days.includes(d)}
            className={`cs-day${days.includes(d) ? ' cs-day--on' : ''}`} onClick={() => toggle(d)}>{label}</button>
        ))}
      </div>
      <div className="cs-row">
        <label className="cs-field"><span>Time (Baku)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="cs-field"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="cs-field"><span>Lessons</span><input type="number" min="1" max="30" value={count} onChange={(e) => setCount(e.target.value)} /></label>
      </div>
      <p className="cc-hint">Topics follow the course after this student's last one. You can change any of them.</p>
      <Button type="submit" size="sm" full disabled={state === 'saving'}>Plan lessons</Button>
      {state && state !== 'saving' && <p className="cc-error" role="alert">{state}</p>}
    </form>
  );
}

// One date + time form, for "add one lesson" and "move this lesson".
function WhenForm({ submitLabel, initialMs, onSubmit }) {
  const [date, setDate] = useState(bakuDateStr(initialMs || Date.now()));
  const [time, setTime] = useState(initialMs ? bakuTime(initialMs) : '19:00');
  const [state, setState] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setState('saving');
    const r = await onSubmit({ date, time });
    setState(r.ok ? '' : r.error);
  };
  return (
    <form className="cs" onSubmit={save}>
      <div className="cs-row cs-row--2">
        <label className="cs-field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="cs-field"><span>Time (Baku)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <Button type="submit" size="sm" full disabled={state === 'saving'}>{submitLabel}</Button>
      {state && state !== 'saving' && <p className="cc-error" role="alert">{state}</p>}
    </form>
  );
}

function LessonRow({ lesson, isNext, onError, onMove, story }) {
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const navigate = useNavigate();
  const run = async (payload) => {
    setBusy(true);
    const r = await tutorCall({ lessonId: lesson.id, ...payload });
    if (!r.ok) onError(r.error);
    setBusy(false);
    setCancelling(false);
  };
  const { status } = lesson;
  const planned = status === 'planned';
  const past = atMs(lesson) < Date.now() + 60 * 60 * 1000;
  const topic = weeklyContent[lesson.topicIndex];

  return (
    <li className={`cc-row cc-row--${status}${isNext ? ' cc-row--next' : ''}`}>
      <div className="cc-when">
        <span className="cc-n">{status === 'held' ? lesson.n : status === 'cancelled' ? '–' : ''}</span>
        <span className="cc-date">{lessonWhen(atMs(lesson), BAKU)}</span>
        {lesson.movedCount > 0 && planned && <span className="cc-tag">moved</span>}
        {status === 'cancelled' && <span className="cc-tag">cancelled by {lesson.cancelledBy || 'student'}</span>}
      </div>
      {planned ? (
        <select className="cc-topic" aria-label="Topic" disabled={busy}
          value={Number.isInteger(lesson.topicIndex) ? String(lesson.topicIndex) : ''}
          onChange={(e) => e.target.value !== '' && run({ action: 'topic', topicIndex: Number(e.target.value) })}>
          <option value="">Pick a topic…</option>
          {weeklyContent.map((t, i) => <option key={i} value={String(i)}>{i + 1}. {t.topic}</option>)}
        </select>
      ) : (
        <span className="cc-topic-text">{topic ? `${lesson.topicIndex + 1}. ${topic.topic}` : '—'}</span>
      )}
      <div className="cc-actions">
        {planned && !cancelling && (
          <>
            {past && (
              <button type="button" className="cc-held" disabled={busy} onClick={() => run({ action: 'held', held: true })}>Mark held</button>
            )}
            {Number.isInteger(lesson.topicIndex) && (
              <button type="button" className="cc-act" onClick={() => navigate(`/class/${lesson.id}`)}>
                <BookOpen size={14} aria-hidden="true" /> Open
              </button>
            )}
            <button type="button" className="cc-act" disabled={busy} onClick={() => onMove(lesson)}>Move</button>
            <button type="button" className="cc-act" disabled={busy} onClick={() => setCancelling(true)}>Cancel</button>
          </>
        )}
        {planned && cancelling && (
          <>
            <span className="cc-ask">Who cancelled?</span>
            <button type="button" className="cc-act" disabled={busy} onClick={() => run({ action: 'cancel', by: 'student' })}>Student</button>
            <button type="button" className="cc-act" disabled={busy} onClick={() => run({ action: 'cancel', by: 'teacher' })}>Me</button>
            <button type="button" className="cc-act" disabled={busy} onClick={() => run({ action: 'remove' })}>Delete</button>
            <button type="button" className="cc-act cc-act--quiet" onClick={() => setCancelling(false)}>Back</button>
          </>
        )}
        {status === 'held' && (
          <button type="button" className="cc-held cc-held--on" aria-pressed="true" disabled={busy}
            onClick={() => run({ action: 'held', held: false })}>
            <Check size={14} strokeWidth={3} aria-hidden="true" /> Held
          </button>
        )}
        {status === 'cancelled' && (
          <button type="button" className="cc-act" disabled={busy} onClick={() => run({ action: 'restore' })}>Restore</button>
        )}
        {story && status !== 'cancelled' && <StoryButton level={story.level} n={story.n} />}
      </div>
    </li>
  );
}

// The teacher's (or admin's) lessons with one student: enrolment (level,
// package, where), the timetable with move / cancel / held per lesson, and
// planning new lessons from a weekly pattern. Every write goes through the
// teacherLesson function.
export default function StudentLessons({ uid, name = '', viewerUid, viewerIsAdmin = viewerUid === ADMIN_UID, canWriteStory = false }) {
  const [enrolment, setEnrolment] = useState(undefined);
  const [lessons, setLessons] = useState([]);
  const [sheet, setSheet] = useState(null); // 'edit' | 'plan' | 'add' | {move: lesson}
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => onSnapshot(
    doc(db, 'tutorStudents', uid),
    (snap) => setEnrolment(snap.exists() ? snap.data() : null),
    () => setEnrolment(null)
  ), [uid]);
  // A teacher's query must name them as the teacher, or the rules (which read
  // each lesson's teacherId) cannot prove it and refuse the whole list.
  useEffect(() => onSnapshot(
    viewerIsAdmin
      ? query(collection(db, 'tutorLessons'), where('uid', '==', uid))
      : query(collection(db, 'tutorLessons'), where('uid', '==', uid), where('teacherId', '==', viewerUid || '')),
    (snap) => setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byDate)),
    (e) => { console.error('[StudentLessons]', e); setLessons([]); }
  ), [uid, viewerUid, viewerIsAdmin]);

  const sum = useMemo(() => packageSummary(enrolment, lessons), [enrolment, lessons]);
  const next = useMemo(() => nextLesson(lessons), [lessons]);
  if (enrolment === undefined) return null;

  const close = () => setSheet(null);
  // The Julian episode each lesson goes with (shared per level, read before
  // the lesson) — only for those who may write and approve it.
  const storyOf = (l) => (canWriteStory && enrolment?.level ? { level: enrolment.level, n: episodeFor(l, lessons) } : null);
  // Lessons still ahead (or not yet marked) first; the rest fold away.
  const open = lessons.filter((l) => l.status === 'planned');
  const done = lessons.filter((l) => l.status !== 'planned').reverse();

  return (
    <section className="tl" aria-label="Lessons">
      <div className="tl-head">
        <h2 className="tl-title">Lessons</h2>
        {enrolment && (
          <button type="button" className="cc-act" onClick={() => setSheet('edit')}>
            {enrolment.level} · {PLATFORM_LABEL[enrolment.platform] || 'Preply'}
          </button>
        )}
      </div>

      {!enrolment ? (
        <>
          <p className="cc-hint">Individual lessons: set this student's level and package, then plan their lessons. They see each lesson's topic and story in the app before the lesson.</p>
          <EnrolForm uid={uid} enrolment={null} onDone={() => {}} />
        </>
      ) : (
        <>
          <div className="tl-sum">
            <span className="cc-count">{sum.held} of {sum.size} held</span>
            <span className="cc-next">{next ? `Next: ${lessonWhen(atMs(next), BAKU)}` : 'Nothing planned'}</span>
          </div>
          {enrolment.active === false && <p className="cc-hint">Lessons are paused. Open the settings above to start again.</p>}
          <StudentBrief uid={uid} name={name} />
          <div className="tl-btns">
            <Button size="sm" variant="secondary" onClick={() => setSheet('plan')}><CalendarPlus size={16} aria-hidden="true" /> Plan lessons</Button>
            <Button size="sm" variant="secondary" onClick={() => setSheet('add')}><Plus size={16} aria-hidden="true" /> Add one</Button>
          </div>
          {error && <p className="cc-error" role="alert">{error}</p>}
          {open.length > 0 && (
            <ol className="cc-list">
              {open.map((l) => (
                <LessonRow key={l.id} lesson={l} isNext={next?.id === l.id} onError={setError} onMove={(m) => setSheet({ move: m })} story={storyOf(l)} />
              ))}
            </ol>
          )}
          {done.length > 0 && (
            <>
              <button type="button" className="tl-more" aria-expanded={showPast} onClick={() => setShowPast(!showPast)}>
                {showPast ? 'Hide past lessons' : `Past lessons (${done.length})`}
              </button>
              {showPast && (
                <ol className="cc-list">
                  {done.map((l) => <LessonRow key={l.id} lesson={l} isNext={false} onError={setError} onMove={() => {}} story={storyOf(l)} />)}
                </ol>
              )}
            </>
          )}
        </>
      )}

      <Sheet open={sheet === 'edit'} onClose={close} title="Lesson settings">
        {sheet === 'edit' && <EnrolForm uid={uid} enrolment={enrolment} onDone={close} />}
        {sheet === 'edit' && enrolment?.active !== false && (
          <button type="button" className="tl-more" onClick={async () => {
            const r = await tutorCall({ action: 'update', uid, active: false });
            if (r.ok) close(); else setError(r.error);
          }}>Pause lessons</button>
        )}
      </Sheet>
      <Sheet open={sheet === 'plan'} onClose={close} title="Plan lessons">
        {sheet === 'plan' && <PlanForm uid={uid} defaultCount={sum.left - sum.planned} onDone={close} />}
      </Sheet>
      <Sheet open={sheet === 'add'} onClose={close} title="Add a lesson">
        {sheet === 'add' && (
          <WhenForm submitLabel="Add lesson" onSubmit={async (w) => {
            const r = await tutorCall({ action: 'add', uid, ...w });
            if (r.ok) close();
            return r;
          }} />
        )}
      </Sheet>
      <Sheet open={!!sheet?.move} onClose={close} title="Move the lesson">
        {sheet?.move && (
          <WhenForm submitLabel="Move" initialMs={atMs(sheet.move)} onSubmit={async (w) => {
            const r = await tutorCall({ action: 'move', lessonId: sheet.move.id, ...w });
            if (r.ok) close();
            return r;
          }} />
        )}
      </Sheet>
    </section>
  );
}
