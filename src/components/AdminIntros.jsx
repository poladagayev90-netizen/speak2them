import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { Plus, Trash2, MessageCircle, Check, X, CalendarPlus, UserCheck, Clock } from 'lucide-react';
import { db } from '../firebase';
import {
  needsIntro, subscribeToAllTeamSlots, subscribeToIntroBookings, createTeamSlot, deleteTeamSlot, markIntro,
} from '../utils/intro';
import { cityOf } from '../utils/timezone';
import './AdminIntros.css';

// Admin → Intros: the team's side of the intro call.
//   1. open times (several in a row with one tap),
//   2. the schedule, each booking shown with the learner's own clock,
//   3. calls that happened and still need an outcome,
//   4. learners who still have to meet the team — including a way to record a
//      meeting that happened elsewhere (WhatsApp, in person).
// Times here are entered and shown in THIS device's clock (the admin is in
// Baku); learners see the same slot in theirs.

const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const localTimeIn = (ms, tz) => {
  try { return new Date(ms).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};
const tomorrowStr = () => {
  const d = new Date(Date.now() + 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function AdminIntros({ users }) {
  const navigate = useNavigate();
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tzByUid, setTzByUid] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const [date, setDate] = useState(tomorrowStr());
  const [time, setTime] = useState('19:00');
  const [duration, setDuration] = useState(15);
  const [count, setCount] = useState(4);
  const [meetUrl, setMeetUrl] = useState('');
  const [hostName, setHostName] = useState('Polad');

  useEffect(() => subscribeToAllTeamSlots(setSlots, Date.now() - 24 * 3600000), []);
  useEffect(() => subscribeToIntroBookings(setBookings), []);
  useEffect(() => onSnapshot(collection(db, 'onboarding'), (snap) => {
    setTzByUid(Object.fromEntries(snap.docs.map((d) => [d.id, d.get('timeZone')])));
  }, () => {}), []);

  const now = Date.now();
  const bookingBySlot = useMemo(() => {
    const m = new Map();
    for (const b of bookings) if (b.status === 'booked' && b.slotId) m.set(b.slotId, b);
    return m;
  }, [bookings]);
  const toMark = bookings.filter((b) => b.status === 'booked' && Number(b.startMs) < now);
  const activeUids = new Set(bookings.filter((b) => b.status === 'booked').map((b) => b.uid || b.id));
  const waiting = (users || [])
    .map((u) => ({ ...u, uid: u.uid || u.id }))
    .filter((u) => needsIntro(u) && !activeUids.has(u.uid));

  const byDay = useMemo(() => {
    const m = new Map();
    for (const s of slots.filter((x) => Number(x.startMs) + (x.durationMin || 15) * 60000 > now)) {
      const k = new Date(s.startMs).toDateString();
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    }
    return [...m.values()];
  }, [slots, now]);

  const add = async () => {
    const start = new Date(`${date}T${time}:00`).getTime();
    if (!Number.isFinite(start) || start < Date.now()) { setMsg({ ok: false, text: 'Pick a time in the future.' }); return; }
    setBusy('add');
    setMsg(null);
    try {
      for (let i = 0; i < count; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await createTeamSlot({ startMs: start + i * duration * 60000, durationMin: duration, meetUrl: meetUrl.trim(), hostName: hostName.trim() });
      }
      setMsg({ ok: true, text: `${count} ${count === 1 ? 'time' : 'times'} added from ${time}.` });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy('');
  };

  const mark = async (uid, outcome) => {
    setBusy(uid + outcome);
    const res = await markIntro(uid, outcome);
    setBusy('');
    if (!res.ok) setMsg({ ok: false, text: res.errorText });
  };

  const remove = async (id) => {
    setBusy(id);
    try { await deleteTeamSlot(id); } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy('');
  };

  const learnerClock = (uid, ms) => {
    const tz = tzByUid[uid];
    if (!tz) return '';
    const theirs = localTimeIn(ms, tz);
    return theirs && theirs !== fmtTime(ms) ? `${theirs} in ${cityOf(tz)}` : '';
  };

  return (
    <div className="ai">
      {msg && <p className={msg.ok ? 'ai-ok' : 'ai-error'}>{msg.text}</p>}

      {toMark.length > 0 && (
        <section className="ai-panel ai-panel--alert">
          <h3 className="ai-h"><Clock size={16} /> How did it go?</h3>
          {toMark.map((b) => (
            <div key={b.id} className="ai-row">
              <div className="ai-row-main">
                <b>{b.name || b.id.slice(0, 6)}</b>
                <span className="ai-muted">{fmtDay(b.startMs)} · {fmtTime(b.startMs)}</span>
              </div>
              <button type="button" className="ai-btn ai-btn--ok" disabled={!!busy} onClick={() => mark(b.uid || b.id, 'done')}><Check size={16} /> Done</button>
              <button type="button" className="ai-btn" disabled={!!busy} onClick={() => mark(b.uid || b.id, 'missed')}><X size={16} /> Missed</button>
            </div>
          ))}
        </section>
      )}

      <section className="ai-panel">
        <h3 className="ai-h"><CalendarPlus size={16} /> Open intro times</h3>
        <div className="ai-form">
          <label>Day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>From<input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} /></label>
          <label>Length
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[15, 20, 30].map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
          <label>In a row
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="ai-wide">Video link (optional — otherwise you call them in the app)
            <input type="url" value={meetUrl} placeholder="https://meet.google.com/…" onChange={(e) => setMeetUrl(e.target.value)} />
          </label>
          <label className="ai-wide">Host name<input value={hostName} maxLength={40} onChange={(e) => setHostName(e.target.value)} /></label>
        </div>
        <button type="button" className="ai-add" disabled={busy === 'add'} onClick={add}>
          <Plus size={16} /> {busy === 'add' ? 'Adding…' : `Add ${count} ${count === 1 ? 'time' : 'times'}`}
        </button>
      </section>

      <section className="ai-panel">
        <h3 className="ai-h"><CalendarPlus size={16} /> Schedule</h3>
        {byDay.length === 0 && <p className="ai-muted">No upcoming times. Learners see "the team adds new times every week".</p>}
        {byDay.map((g) => (
          <div key={g[0].id} className="ai-day">
            <h4 className="ai-sub">{fmtDay(g[0].startMs)}</h4>
            {g.map((s) => {
              const b = bookingBySlot.get(s.id);
              const started = Number(s.startMs) <= now;
              return (
                <div key={s.id} className={`ai-row ${b ? 'is-booked' : ''}`}>
                  <span className="ai-time">{fmtTime(s.startMs)}</span>
                  <div className="ai-row-main">
                    {b ? (
                      <>
                        <b>{b.name || 'Learner'}</b>
                        <span className="ai-muted">{learnerClock(b.uid || b.id, s.startMs) || `${s.durationMin || 15} min`}</span>
                      </>
                    ) : <span className="ai-muted">Open · {s.durationMin || 15} min</span>}
                  </div>
                  {b && (
                    <button type="button" className="ai-btn" onClick={() => navigate(`/chat/${b.uid || b.id}`)} aria-label={`Chat with ${b.name}`}>
                      <MessageCircle size={16} />
                    </button>
                  )}
                  {b && started && (
                    <button type="button" className="ai-btn ai-btn--ok" disabled={!!busy} onClick={() => mark(b.uid || b.id, 'done')}><Check size={16} /></button>
                  )}
                  {!b && !s.booked && (
                    <button type="button" className="ai-btn" disabled={busy === s.id} onClick={() => remove(s.id)} aria-label="Delete this time">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <section className="ai-panel">
        <h3 className="ai-h"><UserCheck size={16} /> Not booked yet ({waiting.length})</h3>
        {waiting.length === 0 && <p className="ai-muted">Everyone who needs an intro has booked one.</p>}
        {waiting.map((u) => (
          <div key={u.uid} className="ai-row">
            <div className="ai-row-main">
              <b>{u.name || u.email || u.uid.slice(0, 6)}</b>
              <span className="ai-muted">{u.email || ''}</span>
            </div>
            <button type="button" className="ai-btn" disabled={!!busy} onClick={() => mark(u.uid, 'done')} title="Met elsewhere — unlock live practice">
              <Check size={16} /> Mark as met
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
