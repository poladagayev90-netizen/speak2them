import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { Activity, PhoneCall, UsersRound } from 'lucide-react';
import { db } from '../firebase';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { getPresence } from '../utils/presence';
import { bakuDayHour, hoursLabel, lastDates } from '../utils/presenceLog';
import { Button } from './ui';
import './AdminApplicants.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const toMs = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : Number(t) || 0);
const hhmm = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baku' });
const dayLabel = (date, today) => (date === today ? 'Today'
  : new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }));
const minutes = (sec) => `${Math.max(1, Math.round(sec / 60))} min`;
const KIND_LABEL = { plan: 'plan', admin: 'your pair', board: 'board', teacher: 'teacher', direct: 'direct', earlier: '' };

// Admin → Activity (Polad 2026-10-07): "who is in the app, who is in a call,
// who practised when" — the platform's pulse, not each analysis.
//
//  · Now — everyone online, the calls running at this moment.
//  · Calls — every finished call (callLog, written once per call by
//    reconcileCallStats): the pair, when, how long, how it was arranged.
//  · In the app — the hours each person had the app open (presenceDays),
//    today or over the last seven days.
//
// Everything is read live or on a slow timer; nothing here writes.
export default function AdminActivity({ users }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const [range, setRange] = useState('today'); // today | week
  const [live, setLive] = useState([]);
  const [log, setLog] = useState(null);
  const [days, setDays] = useState(null);
  const [fill, setFill] = useState('');

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const nameOf = (uid, fallback = '') => byId.get(uid)?.name || fallback || 'Someone';
  const today = bakuDayHour(now).date;
  const dates = useMemo(() => lastDates(range === 'today' ? 1 : 7, now), [range, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calls ringing or running now. A crashed call can stay "accepted" for
  // ever, so one counts only while somebody in it is still in the app.
  useEffect(() => onSnapshot(
    query(collection(db, 'calls'), where('status', 'in', ['calling', 'accepted'])),
    (snap) => setLive(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => { console.error('[AdminActivity] calls', e); setLive([]); }
  ), []);

  // Finished calls of the chosen range, newest first.
  useEffect(() => {
    setLog(null);
    const since = Timestamp.fromMillis(Date.parse(`${dates[dates.length - 1]}T00:00:00+04:00`));
    return onSnapshot(
      query(collection(db, 'callLog'), where('startedAt', '>=', since), orderBy('startedAt', 'desc'), limit(300)),
      (snap) => setLog(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => { console.error('[AdminActivity] callLog', e); setLog([]); }
    );
  }, [dates]);

  // App use by hour. Read every five minutes: an hour fills slowly, and a
  // live listener on everyone's day would re-render on every new hour anyway.
  useEffect(() => {
    let alive = true;
    const load = () => getDocs(query(collection(db, 'presenceDays'), where('date', 'in', dates)))
      .then((snap) => { if (alive) setDays(snap.docs.map((d) => d.data())); })
      .catch((e) => { console.error('[AdminActivity] presence', e); if (alive) setDays([]); });
    load();
    const t = setInterval(load, 5 * 60000);
    return () => { alive = false; clearInterval(t); };
  }, [dates]);

  const online = users
    .map((u) => ({ ...u, presence: getPresence(u, now) }))
    .filter((u) => u.presence !== 'offline')
    .sort((a, b) => (a.presence === 'busy') - (b.presence === 'busy') || String(a.name).localeCompare(String(b.name)));
  const isOn = (uid) => getPresence(byId.get(uid), now) !== 'offline';
  const liveCalls = live
    .map((c) => {
      const uids = [...new Set([c.callerId, c.receiverId, c.userA, c.userB].filter(Boolean))];
      return { ...c, uids, since: toMs(c.connectedAt) || toMs(c.matchedAt) || toMs(c.createdAt) };
    })
    .filter((c) => c.uids.some(isOn) && now - c.since < 3 * 60 * 60 * 1000)
    .sort((a, b) => a.since - b.since);

  const calls = log || [];
  const talked = new Set(calls.flatMap((c) => c.participants || []));
  const totalSec = calls.reduce((s, c) => s + (Number(c.seconds) || 0), 0);
  const callDays = [];
  for (const c of calls) {
    const d = bakuDayHour(toMs(c.startedAt)).date;
    let g = callDays[callDays.length - 1];
    if (!g || g.date !== d) { g = { date: d, items: [] }; callDays.push(g); }
    g.items.push(c);
  }

  // Person × day: hours in the app.
  const people = useMemo(() => {
    const m = new Map();
    for (const d of days || []) {
      const p = m.get(d.uid) || { uid: d.uid, byDate: {}, total: 0 };
      p.byDate[d.date] = d.hours || [];
      p.total += (d.hours || []).length;
      m.set(d.uid, p);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [days]);

  const backfill = async () => {
    setFill('Filling…');
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/adminCallLogBackfill`, { method: 'POST', body: '{}' });
      const body = await res.json().catch(() => ({}));
      setFill(res.ok ? `Done: ${body.written} earlier calls added.` : `Could not fill (${body.error || res.status}).`);
    } catch { setFill('Could not reach the server.'); }
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
      <section className="aa-panel">
        <h3 className="aa-h"><Activity size={16} /> Now</h3>
        <p className="aa-meta">{online.length} in the app · {liveCalls.length} {liveCalls.length === 1 ? 'call' : 'calls'} running</p>
        {liveCalls.length > 0 && (
          <ul className="act-list">
            {liveCalls.map((c) => (
              <li key={c.id} className="act-row act-row--live">
                <PhoneCall size={16} aria-hidden="true" />
                <span className="act-main">{c.uids.map((u) => nameOf(u)).join(' ↔ ')}</span>
                <span className="act-side">{c.status === 'calling' ? 'ringing' : minutes((now - c.since) / 1000)}</span>
              </li>
            ))}
          </ul>
        )}
        {online.length === 0 ? <p className="aa-empty">Nobody is in the app right now.</p> : (
          <div className="act-chips">
            {online.map((u) => (
              <span key={u.id} className={`act-person ${u.presence === 'busy' ? 'is-busy' : ''}`}>
                <i aria-hidden="true" />{u.name || 'Someone'}{u.presence === 'busy' ? ' · in a call' : ''}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="aa-filters" role="tablist" aria-label="Range">
        {[['today', 'Today'], ['week', 'Last 7 days']].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={range === k} className={`aa-chip ${range === k ? 'is-on' : ''}`} onClick={() => setRange(k)}>{label}</button>
        ))}
      </div>

      <section className="aa-panel">
        <h3 className="aa-h"><PhoneCall size={16} /> Calls</h3>
        {log === null ? <p className="aa-empty">Loading…</p> : (
          <>
            <p className="aa-meta">{calls.length} {calls.length === 1 ? 'call' : 'calls'} · {Math.round(totalSec / 60)} min · {talked.size} people</p>
            {calls.length === 0 && <p className="aa-empty">No finished calls {range === 'today' ? 'today' : 'in the last 7 days'} yet.</p>}
            {callDays.map((g) => (
              <div key={g.date} className="act-day">
                {range !== 'today' && <p className="act-day-h">{dayLabel(g.date, today)}</p>}
                <ul className="act-list">
                  {g.items.map((c) => {
                    const [a, b] = c.participants || [];
                    return (
                      <li key={c.id} className="act-row">
                        <span className="act-time">{hhmm(toMs(c.startedAt))}</span>
                        <span className="act-main">{nameOf(a, c.names?.[a])} ↔ {nameOf(b, c.names?.[b])}</span>
                        <span className="act-side">{minutes(c.seconds)}{KIND_LABEL[c.kind] ? ` · ${KIND_LABEL[c.kind]}` : ''}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="aa-panel">
        <h3 className="aa-h"><UsersRound size={16} /> In the app</h3>
        {days === null ? <p className="aa-empty">Loading…</p> : people.length === 0 ? (
          <p className="aa-empty">No app use recorded {range === 'today' ? 'today' : 'in these days'} yet. It is recorded from 7 Oct 2026.</p>
        ) : range === 'today' ? (
          <ul className="act-list">
            {people.map((p) => (
              <li key={p.uid} className="act-row">
                <span className="act-main">{nameOf(p.uid)}</span>
                <span className="act-side">{hoursLabel(p.byDate[today])}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="act-grid" role="table" aria-label="Hours in the app by day">
            <div className="act-grid-row act-grid-head" role="row">
              <span role="columnheader" />
              {[...dates].reverse().map((d) => (
                <span key={d} role="columnheader">{new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' })}</span>
              ))}
            </div>
            {people.map((p) => (
              <div key={p.uid} className="act-grid-row" role="row">
                <span role="rowheader" className="act-grid-name">{nameOf(p.uid)}</span>
                {[...dates].reverse().map((d) => {
                  const h = p.byDate[d] || [];
                  return (
                    <span key={d} role="cell" className={`act-cell ${h.length >= 3 ? 'is-strong' : ''}`} title={h.length ? `${d}: ${hoursLabel(h)}` : `${d}: not in the app`}
                      style={{ '--act-level': Math.min(1, h.length / 4) }}>
                      {h.length || ''}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <p className="aa-meta">{users.filter((u) => toMs(u.lastSeen) > now - DAY_MS).length} people opened the app in the last 24 hours.</p>
      </section>

      <section className="aa-panel">
        <p className="aa-meta">The call list started on 7 Oct 2026. Earlier calls (30 days) can be added once from each person's practice record.</p>
        <Button size="sm" variant="secondary" onClick={backfill} disabled={fill === 'Filling…'}>Add the last 30 days</Button>
        {fill && <p className="aa-meta" role="status">{fill}</p>}
      </section>
    </div>
  );
}

