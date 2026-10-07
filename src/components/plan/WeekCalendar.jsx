import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui';
import TimeGrid from './TimeGrid';
import { saveWeek, saveUsualTimes } from '../../hooks/useMyPlan';
import {
  addDaysKey, autoIn, calendarDays, cellsToHours, hourAhead, MAX_A_WEEK, weekAnswer, weekCells,
} from '../../utils/myWeek';
import { cellsToRanges, rangesToCells } from '../../utils/timezone';
import './plan.css';

// «Your week» at the top of the Plan tab (Polad 2026-10-06: an open calendar
// with the practices per day, easy to manage; 2026-10-07: keep the hour grid
// of onboarding live here, so the choice is as flexible as the first time).
//
// Seven dates, then the hours of that week. It starts from the learner's
// usual free times; a tap changes ONLY this week (a day without usual time
// can be added, a usual one left out). Saving is «I'm in this week» — the
// autopilot plans people who did (or have a package), one practice a day,
// at most four a week (functions/autoRoster.js). Booked and proposed days are
// fixed and always count.
const hhmm = (ms) => new Date(Number(ms)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const span = (hs) => (hs.length === 1 ? hh(hs[0]) : `${String(hs[0]).padStart(2, '0')}–${String(hs[hs.length - 1] + 1).padStart(2, '0')}`);
const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));
const ALL_HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

export default function WeekCalendar({ uid, onboarding, bookings, offers, access, verdict = null, weekKey, now }) {
  const [which, setWhich] = useState(() => {
    // At the weekend the useful week is the next one.
    const wd = new Date(now + 4 * 3600000).getUTCDay();
    return wd === 6 || wd === 0 ? 'next' : 'this';
  });
  const monday = which === 'next' ? addDaysKey(weekKey, 7) : weekKey;
  const answer = weekAnswer(onboarding, monday);
  // In without answering: a package, new this week, or the server counts
  // them as a regular (planStatus.auto).
  const auto = autoIn({ onboarding, access, monday }) || !!(verdict && verdict.week === monday && verdict.in);
  const saved = answer && answer.in;
  const base = useMemo(() => weekCells({ monday, onboarding, now }), [monday, onboarding, now]);
  // «Never» hours of the general week profile (own clock, "wd-h"): shown with
  // an X; picking one for this week is allowed but the planner leaves it out.
  const never = useMemo(() => rangesToCells(onboarding.busyAvailability || []), [onboarding]);
  const [cells, setCells] = useState(null); // null = untouched
  const [allHours, setAllHours] = useState(false);
  const [everyWeek, setEveryWeek] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Another week (or a saved answer arriving) starts again from what is stored.
  const savedKey = `${monday}|${JSON.stringify((onboarding && onboarding.weeks && onboarding.weeks[monday]) || null)}`;
  useEffect(() => { setCells(null); setMsg(''); setEveryWeek(false); }, [savedKey]);

  const shown = cells || (answer && !answer.in ? new Set() : base);
  const start = Date.parse(`${monday}T00:00:00+04:00`);
  const inWeek = (list) => (list || []).filter((x) => Number(x.startMs) >= start && Number(x.startMs) < start + 7 * 86400000);
  const myOffers = inWeek(offers).filter((o) => (o.responses || {})[uid] !== 'declined');
  const days = calendarDays({ monday, onboarding, bookings: inWeek(bookings), offers: myOffers, cells: shown, now });
  const byWd = new Map(days.map((d) => [d.wd, d]));
  const fixed = days.filter((d) => d.state === 'booked' || d.state === 'offered');
  const picked = days.filter((d) => d.state === 'picked');
  const total = picked.length + fixed.length;
  const count = Math.min(MAX_A_WEEK, total);
  const dirty = cells !== null && !sameSet(cells, base);
  const open = days.some((d) => d.state === 'picked' || d.state === 'free' || d.state === 'none');

  // Rows: the hours around what matters this week, unless all are asked for.
  const hours = (() => {
    if (allHours) return ALL_HOURS;
    const hs = [...rangesToCells(onboarding.availability || []), ...shown].map((k) => Number(k.split('-')[1]));
    for (const d of fixed) hs.push(new Date(Number((d.booking || d.offer).startMs)).getHours());
    if (!hs.length) return ALL_HOURS.filter((h) => h >= 18 && h <= 22);
    const lo = Math.max(7, Math.min(...hs) - 1);
    const hi = Math.min(23, Math.max(...hs) + 1);
    return ALL_HOURS.filter((h) => h >= lo && h <= hi);
  })();

  const edit = (fn) => {
    const next = new Set(shown);
    fn(next);
    setCells(next);
    setMsg('');
  };
  const toggleHour = (wd, h) => edit((s) => { const k = `${wd}-${h}`; if (s.has(k)) s.delete(k); else s.add(k); });
  // A tap on the date: drop the day, or bring back its usual hours (20:00 for
  // a day with none).
  const toggleDay = (d) => edit((s) => {
    const mine = [...s].filter((k) => Number(k.split('-')[0]) === d.wd);
    if (d.state === 'picked') { mine.forEach((k) => s.delete(k)); return; }
    const usual = [...rangesToCells(onboarding.availability || [])].filter((k) => Number(k.split('-')[0]) === d.wd)
      .filter((k) => hourAhead(d.date, Number(k.split('-')[1]), now));
    (usual.length ? usual : [`${d.wd}-20`]).forEach((k) => s.add(k));
  });

  const save = async (skip = false) => {
    setBusy(true); setMsg('');
    try {
      if (skip) {
        await saveWeek(uid, onboarding, monday, null);
      } else {
        // Only hours still ahead, on days not already booked or proposed.
        const keep = new Set([...shown].filter((k) => {
          const [wd, h] = k.split('-').map(Number);
          const d = byWd.get(wd);
          return d && d.state === 'picked' && hourAhead(d.date, h, now);
        }));
        await saveWeek(uid, onboarding, monday, { hours: cellsToHours(keep) });
        // A booked or proposed day keeps its usual hours in the usual week.
        if (everyWeek && shown.size) {
          const usual = rangesToCells(onboarding.availability || []);
          const keepDays = new Set(fixed.map((d) => d.wd));
          const every = new Set([...shown, ...[...usual].filter((k) => keepDays.has(Number(k.split('-')[0])))]);
          // A Never hour chosen for every week is not Never any more.
          const stillNever = [...never].filter((k) => !every.has(k));
          await saveUsualTimes(uid, cellsToRanges(every),
            stillNever.length !== never.size ? { busyAvailability: cellsToRanges(new Set(stillNever)) } : {});
        }
      }
      setCells(null);
    } catch {
      setMsg('Could not save. Check your connection and try again.');
    }
    setBusy(false);
  };

  // One status line under the grid.
  const names = [...fixed, ...picked].sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => `${d.dow} ${d.state === 'picked' ? span(d.hours) : hhmm((d.booking || d.offer).startMs)}`);
  let status;
  if (answer && !answer.in && !dirty) status = 'You are taking this week off.';
  else if (!total) status = open ? 'Tap a day or the hours you are free this week.' : 'No time left this week.';
  else if ((saved || auto) && !dirty) status = `You're in · ${names.join(' · ')} · ${count} ${count === 1 ? 'practice' : 'practices'}`;
  else status = `${names.join(' · ')} · ${count} ${count === 1 ? 'practice' : 'practices'}`;
  const capped = total > MAX_A_WEEK;
  // Picked hours that are Never in the usual week: said plainly, not refused.
  const neverPicked = [...shown].filter((k) => never.has(k) && byWd.get(Number(k.split('-')[0]))?.state === 'picked')
    .map((k) => { const [wd, h] = k.split('-').map(Number); return `${byWd.get(wd).dow} ${hh(h)}`; });

  const columns = days.map((d) => ({
    key: d.wd,
    label: d.isToday ? 'Today' : d.dow,
    sub: d.num,
    disabled: d.state === 'past' || d.state === 'booked' || d.state === 'offered',
  }));
  const cell = (wd, h) => {
    const d = byWd.get(wd);
    const label = `${d.dow} ${d.num}, ${hh(h)}`;
    if (d.state === 'booked' || d.state === 'offered') {
      const at = new Date(Number((d.booking || d.offer).startMs)).getHours();
      return { mark: at === h, label: at === h ? `${label}, ${d.state === 'booked' ? 'booked' : 'proposal'}` : label };
    }
    const on = shown.has(`${wd}-${h}`);
    const isNever = never.has(`${wd}-${h}`);
    return { on, never: isNever, disabled: !hourAhead(d.date, h, now), label: isNever ? `${label}, never in your usual week` : label };
  };

  // The day buttons sit on top of their own hour column: a tap on the day
  // takes or drops the whole day, a tap on an hour fine-tunes it.
  const dayButton = (c) => {
    const d = byWd.get(c.key);
    const tappable = d.state === 'free' || d.state === 'picked' || (d.state === 'none' && hourAhead(d.date, 20, now));
    return (
      <button
        type="button"
        className={`wk-day is-${d.state}${d.isToday ? ' is-today' : ''}${tappable ? ' is-tappable' : ''}`}
        onClick={() => toggleDay(d)}
        disabled={!tappable}
        aria-pressed={tappable ? d.state === 'picked' : undefined}
        aria-label={`${d.dow} ${d.num}: ${{
          booked: `practice at ${d.booking && hhmm(d.booking.startMs)}`, offered: 'proposal to answer',
          picked: `picked, ${d.hours ? span(d.hours) : ''}`, free: 'free, not picked', none: 'no usual free time', past: 'past',
        }[d.state]}`}
      >
        <span className="wk-dow">{d.isToday ? 'Today' : d.dow}</span>
        <span className="wk-num">{d.num}</span>
        <span className="wk-mark" aria-hidden="true">
          {d.state === 'booked' && hhmm(d.booking.startMs)}
          {d.state === 'offered' && 'Reply'}
          {d.state === 'picked' && <Check size={13} strokeWidth={3} />}
        </span>
      </button>
    );
  };

  return (
    <section className="pl-card wk" aria-label="Your week">
      <div className="wk-head">
        <p className="wk-title">Your week</p>
        <div className="wk-seg" role="tablist" aria-label="Which week">
          {[['this', 'This week'], ['next', 'Next week']].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={which === k}
              className={`wk-seg-btn${which === k ? ' is-on' : ''}`} onClick={() => setWhich(k)}>{label}</button>
          ))}
        </div>
      </div>

      {(
        <div className="wk-grid">
          <TimeGrid
            compact
            head={dayButton}
            ariaLabel="Your hours this week"
            columns={columns}
            hours={hours}
            cell={cell}
            onToggle={toggleHour}
          />
          {open && (
            <button type="button" className="wk-more" onClick={() => setAllHours((v) => !v)}>
              {allHours ? 'Fewer hours' : 'All hours'}
            </button>
          )}
        </div>
      )}

      <p className="wk-status" role="status">{status}</p>
      {capped && <p className="pl-hint">Up to {MAX_A_WEEK} practices a week — one a day.</p>}
      {neverPicked.length > 0 && (
        <p className="pl-hint">{neverPicked.join(', ')} {neverPicked.length === 1 ? 'is' : 'are'} Never in your usual week, so no practice is planned then. Change it in Free times below.</p>
      )}
      {msg && <p className="pl-hint">{msg}</p>}

      {dirty && shown.size > 0 && (
        <label className="pl-switch pl-text wk-every">
          <input type="checkbox" checked={everyWeek} onChange={(e) => setEveryWeek(e.target.checked)} />
          Use these times every week
        </label>
      )}

      <div className="wk-actions">
        {(dirty || (!saved && !auto)) && open && count > 0 && (
          <Button onClick={() => save(false)} disabled={busy || picked.length === 0}>
            {busy ? 'Saving…' : saved && !dirty ? 'Save this week' : `I'm in · ${count} ${count === 1 ? 'practice' : 'practices'}`}
          </Button>
        )}
        {!(answer && !answer.in) && (saved || auto) && !dirty && (
          <Button variant="ghost" onClick={() => save(true)} disabled={busy}>Not this week</Button>
        )}
      </div>
    </section>
  );
}
