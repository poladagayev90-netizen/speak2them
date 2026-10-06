import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui';
import { saveWeek } from '../../hooks/useMyPlan';
import {
  addDaysKey, autoIn, calendarDays, dayNames, suggestDays, weekAnswer,
} from '../../utils/myWeek';
import './plan.css';

// «Your week» at the top of the Plan tab (Polad 2026-10-06: an open calendar
// with the practices per day, easy to manage). Seven days; a tap picks or
// drops a day. Booked and proposed days are fixed and always count. Saving is
// the learner saying «I'm in this week» — the autopilot plans only people who
// did (or have a package). One practice a day, as the planner does.
const hhmm = (ms) => new Date(Number(ms)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

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
  const saved = answer && answer.in ? answer.days : null;
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // A new week (or a saved answer arriving) resets the picks.
  const savedKey = `${monday}|${saved ? saved.join(',') : answer ? 'skip' : '-'}`;
  useEffect(() => { setPicked(null); setMsg(''); }, [savedKey]);

  const start = Date.parse(`${monday}T00:00:00+04:00`);
  const inWeek = (list) => (list || []).filter((x) => Number(x.startMs) >= start && Number(x.startMs) < start + 7 * 86400000);
  const myOffers = inWeek(offers).filter((o) => (o.responses || {})[uid] !== 'declined');
  const shown = picked || saved || (answer ? [] : suggestDays({ monday, onboarding, now }));
  const days = useMemo(
    () => calendarDays({ monday, onboarding, bookings: inWeek(bookings), offers: myOffers, picked: shown, now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monday, onboarding, bookings, offers, shown.join(','), now],
  );
  const fixed = days.filter((d) => d.state === 'booked' || d.state === 'offered').map((d) => d.wd);
  const all = [...new Set([...shown.filter((wd) => days.some((d) => d.wd === wd && (d.state === 'picked'))), ...fixed])];
  const dirty = picked !== null && (picked.slice().sort().join(',') !== (saved || []).slice().sort().join(','));
  const canPick = days.some((d) => d.state === 'free' || d.state === 'picked');

  const toggle = (d) => {
    if (d.state !== 'free' && d.state !== 'picked') return;
    const cur = new Set(shown);
    if (cur.has(d.wd)) cur.delete(d.wd); else cur.add(d.wd);
    setPicked([...cur]);
    setMsg('');
  };
  const save = async (skip = false) => {
    setBusy(true); setMsg('');
    try {
      await saveWeek(uid, onboarding, monday, skip ? null : all);
      setPicked(null);
    } catch {
      setMsg('Could not save. Check your connection and try again.');
    }
    setBusy(false);
  };

  // One status line under the days.
  let status;
  if (answer && !answer.in) status = 'You are taking this week off.';
  else if (saved) status = `You're in · ${dayNames(all) || 'no days'} · ${all.length} ${all.length === 1 ? 'practice' : 'practices'}`;
  else if (auto) status = `You're in · ${all.length} ${all.length === 1 ? 'practice' : 'practices'} planned for you`;
  else status = canPick ? 'Tap the days you want, then say you are in.' : 'No free time left this week.';

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

      <div className="wk-days">
        {days.map((d) => {
          const tappable = d.state === 'free' || d.state === 'picked';
          return (
            <button
              key={d.date}
              type="button"
              className={`wk-day is-${d.state}${d.isToday ? ' is-today' : ''}`}
              onClick={() => toggle(d)}
              disabled={!tappable}
              aria-pressed={tappable ? d.state === 'picked' : undefined}
              aria-label={`${d.dow} ${d.num}: ${{
                booked: `practice at ${d.booking && hhmm(d.booking.startMs)}`, offered: 'proposal to answer', picked: 'picked',
                free: 'free, not picked', none: 'no free time', past: 'past',
              }[d.state]}`}
            >
              <span className="wk-dow">{d.isToday ? 'Today' : d.dow}</span>
              <span className="wk-num">{d.num}</span>
              <span className="wk-mark" aria-hidden="true">
                {d.state === 'booked' && hhmm(d.booking.startMs)}
                {d.state === 'offered' && 'Reply'}
                {d.state === 'picked' && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="wk-status" role="status">{status}</p>
      {msg && <p className="pl-hint">{msg}</p>}

      <div className="wk-actions">
        {(dirty || (!saved && !auto && !(answer && !answer.in))) && canPick && (
          <Button onClick={() => save(false)} disabled={busy || all.length === 0}>
            {busy ? 'Saving…' : saved ? 'Save my days' : `I'm in · ${all.length} ${all.length === 1 ? 'practice' : 'practices'}`}
          </Button>
        )}
        {answer && !answer.in && canPick && (
          <Button onClick={() => save(false)} disabled={busy || all.length === 0}>Count me in</Button>
        )}
        {!(answer && !answer.in) && (saved || auto) && !dirty && (
          <Button variant="ghost" onClick={() => save(true)} disabled={busy}>Not this week</Button>
        )}
      </div>
    </section>
  );
}
