import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, RefreshCw, Send, PauseCircle, PlayCircle, Trash2, Undo2 } from 'lucide-react';
import { Button } from './ui';
import { offsetVsBaku, formatMinutes, cityOf } from '../utils/timezone';
import {
  weekPlanAction, subscribeToWeekPlan, subscribeToPlanOffers, subscribeToPlannerConfig, setPlannerConfig,
} from '../utils/matchOffers';
import AdminWeekRoster from './AdminWeekRoster';
import { ProposalsPanel } from './AdminOffers';
import './AdminApplicants.css';

// Admin → Week, top to bottom in the order the work happens: who practises
// this week (AdminWeekRoster — nobody else is planned or matched), the plan
// the server drafts every Sunday at 12:00 Baku (functions/weeklyPlanner.js) —
// drop a pair, move it to another time that fits both, hold the automatic
// send, or send now — then the proposals in flight, and the automatic
// switches folded away at the bottom. Once sent, each pair is an ordinary
// proposal, booked only when both say yes.

const DAY_MS = 24 * 60 * 60 * 1000;
// Monday (Baku date) of the week `ms` falls in.
function bakuMonday(ms) {
  const d = new Date(ms + 4 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const weekday = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const dayMonth = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const addDaysTo = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const slotLabel = (slotId) => `${weekday(slotId.slice(0, 10))} ${slotId.slice(11)}:00`;
const firstName = (n) => String(n || '').split(' ')[0] || '—';
// The learner's own clock, only when it differs from Baku.
function localHour(slotId, tz) {
  if (!tz || tz === 'Asia/Baku') return null;
  const diff = offsetVsBaku(tz);
  if (!diff) return null;
  return `${formatMinutes(Number(slotId.slice(11)) * 60 + diff)} ${cityOf(tz)}`;
}

const UNMET = {
  no_times: 'gave no free times this week',
  no_overlap: 'nobody who may be paired with them shares their hours',
  no_partner_left: 'everyone who fits was already full',
};
const OFFER_STATE = {
  pending: 'waiting for answers',
  confirmed: 'booked',
  declined: 'declined',
  expired: 'not answered in time',
  cancelled: 'withdrawn',
  failed: 'could not be booked',
};

export default function AdminWeekPlan({ users = [] }) {
  const now = Date.now();
  // This week first. Until 2026-10-05 "Next week" came first and was the
  // default every day, so on a Monday the admin rebuilt and sent the plan for
  // the FOLLOWING week while meaning the current one. Only on Sunday — the day
  // the draft is built — is next week the one being worked on.
  const weeks = useMemo(() => [
    { key: bakuMonday(now), label: 'This week' },
    { key: bakuMonday(now + 7 * DAY_MS), label: 'Next week' },
  ], [now]);
  const [week, setWeek] = useState(() => (new Date(now + 4 * 60 * 60 * 1000).getUTCDay() === 0 ? weeks[1].key : weeks[0].key));
  const [plan, setPlan] = useState(undefined);
  const [offers, setOffers] = useState([]);
  const [cfg, setCfg] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => { setPlan(undefined); return subscribeToWeekPlan(week, setPlan); }, [week]);
  useEffect(() => subscribeToPlanOffers(week, setOffers), [week]);
  useEffect(() => subscribeToPlannerConfig(setCfg), []);

  const offerById = useMemo(() => new Map(offers.map((o) => [o.id, o])), [offers]);
  const refills = offers.filter((o) => o.source === 'refill');

  const act = async (action, extra = {}) => {
    // Sending messages real learners: name the week in words before it goes.
    if (action === 'send' && !window.confirm(`Send ${live.length} proposals for the week of ${dayMonth(week)}–${dayMonth(addDaysTo(week, 6))}?`)) return;
    setBusy(action + (extra.pairId || ''));
    setMsg(null);
    const res = await weekPlanAction(action, week, extra);
    setBusy('');
    if (!res.ok) { setMsg({ ok: false, text: res.errorText }); return; }
    const d = res.data || {};
    if (action === 'build') setMsg({ ok: true, text: `Drafted ${d.pairs} pairs for ${d.learners} learners; ${d.unmet} short of their target.` });
    if (action === 'send') setMsg({ ok: true, text: d.alreadySent ? 'Already sent.' : `Sent ${d.offers} proposals to ${d.people} learners.` });
  };
  const toggle = (key) => setPlannerConfig({ [key]: !cfg[key] })
    .catch(() => setMsg({ ok: false, text: 'Could not save the setting.' }));

  const draft = plan && plan.status === 'draft';
  const pairs = useMemo(() => (plan && plan.pairs) || [], [plan]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const p of pairs) {
      const d = p.slotId.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(p);
    }
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [pairs]);
  const live = pairs.filter((p) => !p.removed);

  return (
    <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
      <div className="aa-filters" role="tablist" aria-label="Week">
        {weeks.map((w) => (
          <button key={w.key} type="button" role="tab" aria-selected={week === w.key}
            className={`aa-chip ${week === w.key ? 'is-on' : ''}`} onClick={() => setWeek(w.key)}>
            {w.label} · {dayMonth(w.key)}–{dayMonth(addDaysTo(w.key, 6))}
          </button>
        ))}
      </div>

      <AdminWeekRoster week={week} users={users} />

      <section className="aa-panel">
        <h3 className="aa-h">
          Plan for the week of {dayMonth(week)}
          {plan && <span className="aa-badge aa-badge--soft" style={{ marginLeft: 'var(--s-2)' }}>{plan.status === 'sent' ? 'sent' : plan.hold ? 'draft · held' : 'draft'}</span>}
        </h3>
        {plan === undefined ? <p className="aa-empty">Loading…</p> : !plan ? (
          <p className="aa-empty">No draft yet. It is built on Sunday at 12:00 — or build it now.</p>
        ) : plan.noRoster ? (
          <p className="aa-error">Nobody was planned: this week has no list. Tick who practises above, save, then rebuild.</p>
        ) : (
          <p className="aa-meta">
            {live.length} pairs · {plan.stats?.learners ?? '—'} learners planned · {(plan.unmet || []).length} short of their target
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
          {(!plan || draft) && (
            <Button size="sm" variant="secondary" icon={<RefreshCw size={16} aria-hidden="true" />}
              disabled={!!busy} onClick={() => act('build')}>{plan ? 'Rebuild' : 'Build now'}</Button>
          )}
          {draft && (plan.hold
            ? <Button size="sm" variant="secondary" icon={<PlayCircle size={16} aria-hidden="true" />} disabled={!!busy} onClick={() => act('resume')}>Resume auto-send</Button>
            : <Button size="sm" variant="secondary" icon={<PauseCircle size={16} aria-hidden="true" />} disabled={!!busy} onClick={() => act('hold')}>Hold</Button>)}
          {draft && live.length > 0 && (
            <Button size="sm" icon={<Send size={16} aria-hidden="true" />} disabled={!!busy} onClick={() => act('send')}>
              Send {live.length} proposals now
            </Button>
          )}
        </div>
        {msg && <p className={msg.ok ? 'aa-ok' : 'aa-error'} role="status">{msg.text}</p>}
      </section>

      {byDay.map(([date, list]) => (
        <section key={date} className="aa-panel">
          <h3 className="aa-h">{weekday(date)} {dayMonth(date)}</h3>
          <ul className="aa-offers">
            {list.map((p) => {
              const offer = p.offerId ? offerById.get(p.offerId) : null;
              const la = localHour(p.slotId, p.tzA);
              const lb = localHour(p.slotId, p.tzB);
              return (
                <li key={p.id} className="aa-offer" style={p.removed ? { opacity: 0.55 } : undefined}>
                  <div className="aa-name" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span style={p.removed ? { textDecoration: 'line-through' } : undefined}>
                      {slotLabel(p.slotId)} Baku · {firstName(p.nameA)} <span className="aa-level">{String(p.levelA || '?').slice(0, 2)}</span>
                      {' + '}{firstName(p.nameB)} <span className="aa-level">{String(p.levelB || '?').slice(0, 2)}</span>
                    </span>
                    {offer && <span className="aa-badge aa-badge--soft">{OFFER_STATE[offer.status] || offer.status}</span>}
                    {!offer && p.skip && <span className="aa-badge">not sent: {p.skip}</span>}
                  </div>
                  <p className="aa-meta">
                    {[la && `${firstName(p.nameA)} ${la}`, lb && `${firstName(p.nameB)} ${lb}`].filter(Boolean).join(' · ')}
                    {(la || lb) ? ' · ' : ''}{(p.reasons || []).join(' · ')}
                  </p>
                  {draft && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)', alignItems: 'center' }}>
                      {p.removed ? (
                        <Button size="sm" variant="ghost" icon={<Undo2 size={16} aria-hidden="true" />} disabled={!!busy}
                          onClick={() => act('restore', { pairId: p.id })}>Restore</Button>
                      ) : (
                        <Button size="sm" variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} disabled={!!busy}
                          onClick={() => act('remove', { pairId: p.id })}>Remove</Button>
                      )}
                      {!p.removed && (p.alternatives || []).length > 0 && (
                        <select className="aa-select" aria-label={`Move ${firstName(p.nameA)} and ${firstName(p.nameB)}`}
                          value="" disabled={!!busy}
                          onChange={(e) => e.target.value && act('move', { pairId: p.id, slotId: e.target.value })}>
                          <option value="">Move to…</option>
                          {p.alternatives.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {plan && (plan.unmet || []).length > 0 && (
        <section className="aa-panel">
          <h3 className="aa-h">Short of their target</h3>
          <ul className="aa-offers">
            {plan.unmet.map((u) => (
              <li key={u.uid} className="aa-offer">
                <span className="aa-name">{u.name || '—'} <span className="aa-level">{String(u.level || '?').slice(0, 2)}</span></span>
                <p className="aa-meta">{u.got} of {u.wanted} — {UNMET[u.reason] || u.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {refills.length > 0 && (
        <section className="aa-panel">
          <h3 className="aa-h">Refills this week</h3>
          <ul className="aa-offers">
            {refills.map((o) => (
              <li key={o.id} className="aa-offer">
                <span className="aa-name">{slotLabel(o.slotId)} Baku · {firstName(o.nameA)} + {firstName(o.nameB)}</span>
                <p className="aa-meta">{OFFER_STATE[o.status] || o.status}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ProposalsPanel />

      <details className="aa-panel aa-fold">
        <summary className="aa-h">Automatic steps <ChevronDown size={18} className="aa-chev" aria-hidden="true" /></summary>
        {[
          ['autoSend', 'Send the draft automatically on Sunday at 20:00 (unless held)'],
          ['refill', 'Refill during the week: new proposals for people still short of their target'],
          ['requireCharter', 'Plan only learners who accepted the practice charter'],
        ].map(([key, label]) => (
          <label key={key} className="aa-meta" style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}>
            <input type="checkbox" className="aa-check" checked={!!cfg[key]} onChange={() => toggle(key)} />
            {label}
          </label>
        ))}
        <p className="aa-empty">Both send switches message real learners. The draft itself is built every Sunday at 12:00 either way.</p>
      </details>

    </div>
  );
}
