import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { ADMIN_UID } from '../../constants';
import { MAX_LESSONS } from '../../utils/cohortLessons';
import Button from '../ui/Button';
import './cohort.css';

// Monday first, as a teacher reads a week; values are Baku weekdays (0 = Sun).
const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const pad = (n) => String(n).padStart(2, '0');

// Admin → Cohorts: turns a cohort into a class — who teaches it, how many
// lessons were bought, which weekdays, what time (Baku) and from which date.
// Admin-only write (cohorts rules), so no endpoint.
export default function ClassSettings({ cohort }) {
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState(cohort.teacherId || ADMIN_UID);
  const [count, setCount] = useState(String(cohort.lessonCount || 12));
  const [days, setDays] = useState(Array.isArray(cohort.lessonDays) ? cohort.lessonDays.map(Number) : [2, 4]);
  const [time, setTime] = useState(Number.isFinite(cohort.lessonMin)
    ? `${pad(Math.floor(cohort.lessonMin / 60))}:${pad(cohort.lessonMin % 60)}` : '19:00');
  const [startDate, setStartDate] = useState(cohort.startDate || '');
  const [level, setLevel] = useState(cohort.level === 'A2' ? 'A2' : 'B1');
  const [state, setState] = useState('');

  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')))
      .then((snap) => setTeachers(snap.docs.map((d) => ({ id: d.id, name: d.get('name') || d.id }))))
      .catch(() => setTeachers([]));
  }, []);

  const toggleDay = (d) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const save = async (e) => {
    e.preventDefault();
    const lessonCount = Math.round(Number(count));
    const [h, m] = time.split(':').map(Number);
    if (!(lessonCount >= 1 && lessonCount <= MAX_LESSONS)) { setState(`Lessons must be 1–${MAX_LESSONS}.`); return; }
    if (days.length === 0) { setState('Pick at least one lesson day.'); return; }
    if (!Number.isFinite(h) || !Number.isFinite(m)) { setState('Set a lesson time.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { setState('Set the start date.'); return; }
    setState('saving');
    try {
      await updateDoc(doc(db, 'cohorts', cohort.id), {
        teacherId, lessonCount, lessonDays: [...days].sort((a, b) => a - b), lessonMin: h * 60 + m, startDate, level,
      });
      setState('saved');
    } catch (err) {
      console.error('[ClassSettings]', err);
      setState('Not saved.');
    }
  };

  const message = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved.' : state;

  return (
    <form className="cs" onSubmit={save}>
      <label className="cs-field">
        <span>Teacher</span>
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value={ADMIN_UID}>Me (admin)</option>
          {teachers.filter((t) => t.id !== ADMIN_UID).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <label className="cs-field">
        <span>Story level</span>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="A2">A2+ (shorter, simpler)</option>
          <option value="B1">B1</option>
        </select>
      </label>
      <div className="cs-row">
        <label className="cs-field">
          <span>Lessons</span>
          <input type="number" min="1" max={MAX_LESSONS} value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <label className="cs-field">
          <span>Time (Baku)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="cs-field">
          <span>Starts</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
      </div>
      <div className="cs-days" role="group" aria-label="Lesson days">
        {DAYS.map(([d, label]) => (
          <button key={d} type="button" aria-pressed={days.includes(d)}
            className={`cs-day${days.includes(d) ? ' cs-day--on' : ''}`} onClick={() => toggleDay(d)}>
            {label}
          </button>
        ))}
      </div>
      <Button type="submit" size="sm" full disabled={state === 'saving'}>Save class</Button>
      {message && <p className="cs-msg" role="status">{message}</p>}
    </form>
  );
}
