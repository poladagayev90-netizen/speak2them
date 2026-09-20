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
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tomorrowStr = () => dayStr(new Date(Date.now() + 86400000));

// The next ten days as taps. A native <input type="date"> needs three
// interactions to say "tomorrow", and on a phone with a large system font its
// own minimum width is what pushed this panel wider than the screen.
const DAY_CHOICES = () => Array.from({ length: 10 }, (_, i) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return {
    value: dayStr(d),
    label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
  };
});

// The hours the team actually opens. Anything else is still reachable through
// the half-hour toggle; nobody opens an intro call at 03:15.
const HOURS = [10, 12, 14, 16, 17, 18, 19, 20, 21, 22];

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
  const [showDetails, setShowDetails] = useState(false);
  const hourRowRef = React.useRef(null);

  useEffect(() => {
    const on = hourRowRef.current && hourRowRef.current.querySelector('.is-on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [time]);

  useEffect(() => subscribeToAllTeamSlots(setSlots, Date.now() - 24 * 3600000), []);
  useEffect(() => subscribeToIntroBookings(setBookings), []);
  useEffect(() => onSnapshot(collection(db, 'onboarding'), (snap) => {
    setTzByUid(Object.fromEntries(snap.docs.map((d) => [d.id, d.get('timeZone')])));
  }, () => {}), []);

  const now = Date.now();

  // "Tue 23 Sept · 19:00 → 20:00, 4 × 15 min" — the sentence the button is
  // about to carry out, so a mistake is seen before it becomes six slots.
  const spanLabel = useMemo(() => {
    const start = new Date(`${date}T${time}:00`).getTime();
    if (!Number.isFinite(start)) return '';
    const end = start + count * duration * 60000;
    const past = start < Date.now() ? ' · this time has passed' : '';
    return `${fmtDay(start)} · ${fmtTime(start)} → ${fmtTime(end)}${past}`;
  }, [date, time, count, duration]);

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
        {/* Taps, not fields. Opening times is the one thing done here every
            week, and it used to take a date picker, a time picker and two
            dropdowns — four native widgets whose own minimum widths pushed this
            panel wider than a phone screen. */}
        <p className="ai-pick-label">Day</p>
        <div className="ai-chips">
          {DAY_CHOICES().map((d) => (
            <button
              key={d.value}
              type="button"
              className={`ai-chip ${date === d.value ? 'is-on' : ''}`}
              onClick={() => setDate(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <p className="ai-pick-label">Starting at</p>
        {/* The chosen hour is usually an evening one, which sits off the right
            edge of the row — so the row arrives scrolled to it instead of
            looking as though 10:00 were selected. */}
        <div className="ai-chips" ref={hourRowRef}>
          {HOURS.map((h) => {
            const value = `${pad(h)}:${time.slice(3)}`;
            return (
              <button
                key={h}
                type="button"
                className={`ai-chip ${time.startsWith(pad(h)) ? 'is-on' : ''}`}
                onClick={() => setTime(value)}
              >
                {pad(h)}:{time.slice(3)}
              </button>
            );
          })}
          <button
            type="button"
            className={`ai-chip ai-chip--half ${time.endsWith(':30') ? 'is-on' : ''}`}
            onClick={() => setTime(`${time.slice(0, 3)}${time.endsWith(':30') ? '00' : '30'}`)}
          >
            +30 min
          </button>
        </div>

        <p className="ai-pick-label">How many, back to back</p>
        <div className="ai-chips">
          {[1, 2, 3, 4, 6, 8].map((n) => (
            <button key={n} type="button" className={`ai-chip ${count === n ? 'is-on' : ''}`} onClick={() => setCount(n)}>
              {n}
            </button>
          ))}
        </div>

        <p className="ai-pick-label">Each one lasts</p>
        <div className="ai-chips">
          {[15, 20, 30].map((d) => (
            <button key={d} type="button" className={`ai-chip ${duration === d ? 'is-on' : ''}`} onClick={() => setDuration(d)}>
              {d} min
            </button>
          ))}
        </div>

        {/* Set once and then forgotten, so it does not take up room until it is
            asked for. */}
        <button type="button" className="ai-more" onClick={() => setShowDetails((v) => !v)}>
          {showDetails ? 'Hide' : 'Video link and host name'}
        </button>
        {showDetails && (
          <div className="ai-form">
            <label className="ai-wide">Video link (optional — otherwise you call them in the app)
              <input type="url" value={meetUrl} placeholder="https://meet.google.com/…" onChange={(e) => setMeetUrl(e.target.value)} />
            </label>
            <label className="ai-wide">Host name<input value={hostName} maxLength={40} onChange={(e) => setHostName(e.target.value)} /></label>
          </div>
        )}

        {/* What will actually be created, in words, before it is created. */}
        <p className="ai-preview">{spanLabel}</p>
        <button type="button" className="ai-add" disabled={busy === 'add'} onClick={add}>
          <Plus size={16} /> {busy === 'add' ? 'Adding…' : `Open ${count} ${count === 1 ? 'time' : 'times'}`}
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
