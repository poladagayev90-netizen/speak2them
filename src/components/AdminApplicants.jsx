import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ChevronDown, Clock, Users, CalendarClock } from 'lucide-react';
import { db } from '../firebase';
import {
  WEEK_DAYS, toBakuIntervals, overlapAll, intervalsByDay, formatMinutes,
  formatLocalNow, formatOffsetVsBaku, offsetVsBaku, cityOf, totalHours,
} from '../utils/timezone';
import { AGE_BANDS, GOALS, LEVELS, labelOf } from '../utils/onboarding';
import './AdminApplicants.css';

// Admin "Applicants": every learner's onboarding answers in one place, with
// their clock next to Baku's.
//
// It exists because pairing people by hand used to mean asking one person when
// they are free, promising them a partner, then asking the other and hearing
// "no" — the first one was left waiting on a promise. Here the admin sees both
// people's availability BEFORE saying anything to anyone, on one common clock.

const HEAT_HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07–24 Baku
const toMs = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);
const levelShort = (lv) => LEVELS.find((l) => l.value === lv)?.short || (lv || '').slice(0, 2) || '—';

function daysOf(ranges) {
  return WEEK_DAYS
    .map((d) => ({ ...d, rs: ranges.filter((r) => r.day === d.day) }))
    .filter((d) => d.rs.length);
}
const fmtRange = (r) => `${formatMinutes(r.startMin)}–${r.endMin === 1440 ? '24:00' : formatMinutes(r.endMin)}`;

export default function AdminApplicants({ users }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [selected, setSelected] = useState([]);
  const [levelFilter, setLevelFilter] = useState('All');
  const [ageFilter, setAgeFilter] = useState('All');
  // Re-render every minute so "their time now" stays true while the tab is open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => onSnapshot(
    collection(db, 'onboarding'),
    (snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setError(''); },
    (e) => setError(e.code === 'permission-denied' ? 'No access to onboarding answers (rules not deployed?)' : e.message),
  ), []);

  const byUid = useMemo(() => {
    const m = new Map();
    for (const u of users || []) m.set(u.uid || u.id, u);
    return m;
  }, [users]);

  const people = useMemo(() => rows
    .map((r) => {
      const u = byUid.get(r.id) || {};
      const availability = Array.isArray(r.availability) ? r.availability : [];
      return {
        ...r,
        name: u.name || u.email || r.id.slice(0, 6),
        email: u.email || '',
        availability,
        baku: toBakuIntervals(availability, r.timeZone),
        isNew: !r.adminSeenAt,
        isUpdated: !!r.adminSeenAt && toMs(r.updatedAt) > toMs(r.adminSeenAt) + 5000,
      };
    })
    .filter((p) => levelFilter === 'All' || levelShort(p.level) === levelFilter)
    .filter((p) => ageFilter === 'All' || p.ageBand === ageFilter)
    .sort((a, b) => (b.isNew - a.isNew) || (toMs(b.submittedAt) - toMs(a.submittedAt))), [rows, byUid, levelFilter, ageFilter]);

  const chosen = people.filter((p) => selected.includes(p.id));
  const overlap = useMemo(
    () => (chosen.length >= 2 ? intervalsByDay(overlapAll(chosen.map((p) => p.baku))) : []),
    [chosen],
  );

  // How many (filtered) people are free in each Baku hour — the evidence for
  // choosing fixed practice hours, instead of guessing 15:00 or 21:00.
  const heat = useMemo(() => {
    const counts = new Map();
    let max = 0;
    for (const p of people) {
      for (const d of WEEK_DAYS) {
        for (const h of HEAT_HOURS) {
          const a = d.day * 1440 + h * 60;
          const b = a + 60;
          if (p.baku.some(([x, y]) => x < b && y > a)) {
            const k = `${d.day}-${h}`;
            const n = (counts.get(k) || 0) + 1;
            counts.set(k, n);
            if (n > max) max = n;
          }
        }
      }
    }
    return { counts, max };
  }, [people]);

  const toggleOpen = async (p) => {
    const next = open === p.id ? null : p.id;
    setOpen(next);
    if (next && (p.isNew || p.isUpdated)) {
      try {
        await updateDoc(doc(db, 'onboarding', p.id), { adminSeenAt: serverTimestamp() });
      } catch (e) {
        console.warn('[AdminApplicants] mark seen failed', e.message);
      }
    }
  };

  const toggleSelect = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const newCount = people.filter((p) => p.isNew).length;

  return (
    <div className="aa">
      {error && <p className="aa-error">{error}</p>}

      <div className="aa-filters">
        {['All', ...LEVELS.map((l) => l.short)].map((l) => (
          <button key={l} type="button" className={`aa-chip ${levelFilter === l ? 'is-on' : ''}`} onClick={() => setLevelFilter(l)}>{l}</button>
        ))}
        <select className="aa-select" value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} aria-label="Age filter">
          <option value="All">All ages</option>
          {AGE_BANDS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      <p className="aa-meta">
        {people.length} {people.length === 1 ? 'learner' : 'learners'}
        {newCount > 0 && <> · <b>{newCount} new</b></>}
        {' '}· tick two or more to see their common time
      </p>

      {chosen.length >= 2 && (
        <section className="aa-panel">
          <h3 className="aa-h"><Users size={16} /> Common free time — {chosen.map((p) => p.name.split(' ')[0]).join(' + ')}</h3>
          {overlap.length === 0 ? (
            <p className="aa-empty">No shared hour this week. Pick someone else, or ask one of them to widen their hours.</p>
          ) : (
            <ul className="aa-overlap">
              {overlap.map((r) => (
                <li key={`${r.day}-${r.startMin}`}>
                  <span className="aa-day">{WEEK_DAYS.find((d) => d.day === r.day)?.short}</span>
                  <b>{fmtRange(r)}</b> <span className="aa-muted">Baku</span>
                  <span className="aa-locals">
                    {chosen.filter((p) => offsetVsBaku(p.timeZone) !== 0).map((p) => (
                      <span key={p.id}>{p.name.split(' ')[0]} {formatMinutes(r.startMin + offsetVsBaku(p.timeZone))}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="aa-panel">
        <h3 className="aa-h"><CalendarClock size={16} /> Who is free when (Baku time)</h3>
        <div className="aa-heat" role="table" aria-label="Free learners per hour">
          <div className="aa-heat-row aa-heat-head" role="row">
            <span />
            {WEEK_DAYS.map((d) => <span key={d.day}>{d.short}</span>)}
          </div>
          {HEAT_HOURS.map((h) => (
            <div key={h} className="aa-heat-row" role="row">
              <span className="aa-heat-hour">{String(h).padStart(2, '0')}</span>
              {WEEK_DAYS.map((d) => {
                const n = heat.counts.get(`${d.day}-${h}`) || 0;
                const alpha = n && heat.max ? 0.15 + 0.85 * (n / heat.max) : 0;
                return (
                  <span
                    key={d.day}
                    className="aa-heat-cell"
                    style={{ background: n ? `rgb(var(--accent-rgb) / ${alpha.toFixed(2)})` : undefined, color: alpha > 0.55 ? 'var(--text-on-accent)' : undefined }}
                    title={`${d.short} ${String(h).padStart(2, '0')}:00 — ${n} free`}
                  >
                    {n || ''}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <ul className="aa-list">
        {people.map((p) => {
          const expanded = open === p.id;
          return (
            <li key={p.id} className={`aa-card ${expanded ? 'is-open' : ''}`}>
              <div className="aa-card-top">
                <input
                  type="checkbox"
                  className="aa-check"
                  checked={selected.includes(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  aria-label={`Select ${p.name} for common time`}
                />
                <button type="button" className="aa-card-main" onClick={() => toggleOpen(p)} aria-expanded={expanded}>
                  <span className="aa-name">
                    {p.name}
                    {p.isNew && <span className="aa-badge">New</span>}
                    {p.isUpdated && <span className="aa-badge aa-badge--soft">Updated</span>}
                  </span>
                  <span className="aa-line">
                    <b className="aa-level">{levelShort(p.level)}</b>
                    {labelOf(AGE_BANDS, p.ageBand)} · {p.country || '—'} · {p.weeklyTarget || '?'}/week
                  </span>
                  <span className="aa-line aa-muted">
                    <Clock size={13} /> {formatLocalNow(p.timeZone)} in {cityOf(p.timeZone)} · {formatOffsetVsBaku(p.timeZone)}
                  </span>
                </button>
                <ChevronDown size={18} className="aa-chev" aria-hidden="true" />
              </div>

              {expanded && (
                <div className="aa-detail">
                  <p className="aa-line"><span className="aa-muted">Goal</span> {labelOf(GOALS, p.goal)}</p>
                  <p className="aa-line"><span className="aa-muted">Topics</span> {(p.topics || []).join(', ') || '—'}</p>
                  {p.email && <p className="aa-line"><span className="aa-muted">Email</span> {p.email}</p>}
                  <p className="aa-line">
                    <span className="aa-muted">Free</span> {totalHours(p.availability)} h/week, wants {p.weeklyTarget || '?'} practices
                  </p>
                  <div className="aa-cols">
                    <div>
                      <h4 className="aa-sub">Their time ({cityOf(p.timeZone)})</h4>
                      {daysOf(p.availability).map((d) => (
                        <p key={d.day} className="aa-range"><span className="aa-day">{d.short}</span> {d.rs.map(fmtRange).join(', ')}</p>
                      ))}
                    </div>
                    {offsetVsBaku(p.timeZone) !== 0 && (
                      <div>
                        <h4 className="aa-sub">Baku time</h4>
                        {daysOf(intervalsByDay(p.baku)).map((d) => (
                          <p key={d.day} className="aa-range"><span className="aa-day">{d.short}</span> {d.rs.map(fmtRange).join(', ')}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {people.length === 0 && !error && <li className="aa-empty">No onboarding answers yet.</li>}
      </ul>
    </div>
  );
}
