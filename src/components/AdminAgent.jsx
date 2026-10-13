import React, { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { Bot, Play } from 'lucide-react';
import { db } from '../firebase';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { Button } from './ui';
import { FlagButton, useAccountHealth } from './AdminWeekRoster';
import './AdminApplicants.css';

// Admin → Agent: the AI planning analyst (functions/agent, Mərhələ 2).
// Gemini reads anonymous numbers every morning (and Sunday 11:00 for next
// week), scores the allowed pairs a little up or down, suggests accounts to
// look at and writes a short report. The planner still decides who meets
// when. Off → nothing runs. Shadow → the plan stays the deterministic one and
// the AI version is shown here beside it. Act → the AI version is used when it
// gives at least as many people a practice. A monthly budget stops it.

const DAY_MS = 24 * 60 * 60 * 1000;
function bakuMonday(ms) {
  const d = new Date(ms + 4 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const bakuMonth = (ms) => new Date(ms + 4 * 60 * 60 * 1000).toISOString().slice(0, 7);
// "Leyla + Murad · 2026-10-21-21" → "Leyla + Murad · Wed 21 Oct 21:00" (Baku).
const pairLabel = (label) => String(label || '').replace(/(\d{4}-\d{2}-\d{2})-(\d{2})$/, (m, d, h) => {
  const day = new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${day} ${h}:00`;
});
const dayMonth = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function useDoc(path) {
  const [data, setData] = useState(undefined);
  useEffect(() => onSnapshot(doc(db, ...path.split('/')), (s) => setData(s.exists() ? s.data() : null), () => setData(null)), [path]);
  return data;
}

export default function AdminAgent() {
  const now = Date.now();
  const cfg = useDoc('appConfig/agent');
  const usage = useDoc(`agentUsage/${bakuMonth(now)}`);
  const thisWeek = bakuMonday(now);
  const nextWeek = new Date(Date.parse(`${thisWeek}T12:00:00Z`) + 7 * DAY_MS).toISOString().slice(0, 10);
  const runThis = useDoc(`agentRuns/${thisWeek}`);
  const runNext = useDoc(`agentRuns/${nextWeek}`);
  const health = useAccountHealth();
  const [reports, setReports] = useState(null);
  const [budget, setBudget] = useState('');
  const [state, setState] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'agentReports'), orderBy('at', 'desc'), limit(7)),
    (s) => setReports(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setReports([])), []);
  useEffect(() => { if (cfg !== undefined) setBudget(String(cfg?.monthlyBudgetUsd ?? 5)); }, [cfg]);

  if (cfg === undefined) return <section className="aa-panel"><p className="aa-empty">Loading…</p></section>;
  const enabled = cfg?.enabled === true;
  const mode = cfg?.mode === 'act' ? 'act' : 'shadow';
  const limitUsd = Number(cfg?.monthlyBudgetUsd ?? 5);
  const spent = Number(usage?.usd || 0);

  const save = async (patch) => {
    setState('');
    await setDoc(doc(db, 'appConfig', 'agent'), patch, { merge: true }).catch((e) => setState(`Not saved: ${e.code || e.message}`));
  };
  const runNow = async () => {
    setState('running');
    try {
      const res = await authedFetch(`${FUNCTIONS_BASE}/adminAgent`, { method: 'POST', body: JSON.stringify({ action: 'run' }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setState(`Failed: ${d.error || res.status}`);
      else if (d.skipped) setState(`Not run: ${d.skipped}${d.error ? ` (${d.error})` : ''}`);
      else setState(`Done: ${d.scored} pairs scored, ${d.flags} accounts to look at, $${Number(d.usd || 0).toFixed(4)}.`);
    } catch (e) { setState(`Failed: ${e.message}`); }
  };

  return (
    <>
      <section className="aa-panel">
        <h3 className="aa-h"><Bot size={16} /> AI analyst</h3>
        <p className="aa-meta">
          Every morning it reads anonymous practice numbers (no names, no personal data), scores the allowed pairs
          a little up or down, suggests accounts to look at and writes a report. The planner still decides who meets when.
        </p>
        <div className="aa-mode" role="group" aria-label="AI analyst">
          <button type="button" className={`aa-chip ${!enabled ? 'is-on' : ''}`} onClick={() => save({ enabled: false })}>Off</button>
          <button type="button" className={`aa-chip ${enabled && mode === 'shadow' ? 'is-on' : ''}`} onClick={() => save({ enabled: true, mode: 'shadow' })}>Shadow</button>
          <button type="button" className={`aa-chip ${enabled && mode === 'act' ? 'is-on' : ''}`} onClick={() => save({ enabled: true, mode: 'act' })}>Act</button>
        </div>
        <p className="aa-meta">
          {!enabled ? 'Off: nothing runs, the planner works as before.'
            : mode === 'shadow' ? 'Shadow: the plan stays the usual one; the AI version is shown below for comparison.'
              : 'Act: the plan and the refill use the AI scores, unless that gives fewer people a practice.'}
        </p>
        <div className="aa-filters">
          <label className="aa-search aa-budget">
            <span className="aa-meta">$/month</span>
            <input type="number" min="0" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Monthly budget in dollars" />
          </label>
          <Button size="sm" variant="ghost" disabled={Number(budget) === limitUsd || !(Number(budget) >= 0)} onClick={() => save({ monthlyBudgetUsd: Number(budget) })}>Save budget</Button>
          <Button size="sm" icon={<Play size={16} aria-hidden="true" />} disabled={!enabled || state === 'running'} onClick={runNow}>{state === 'running' ? 'Running…' : 'Run now'}</Button>
        </div>
        <p className="aa-meta">
          This month: <b>${spent.toFixed(3)}</b> of ${limitUsd.toFixed(2)} · {usage?.calls || 0} runs · model {cfg?.model || 'gemini-3.8-flash'}
          {spent >= limitUsd && enabled ? ' · budget reached, paused until next month' : ''}
        </p>
        {state && state !== 'running' && <p className={state.startsWith('Done') ? 'aa-ok' : 'aa-error'} role="status">{state}</p>}
      </section>

      {[runThis, runNext].map((r) => r && (
        <section key={r.weekKey} className="aa-panel">
          <h3 className="aa-h">Plan with and without AI · week of {dayMonth(r.weekKey)}</h3>
          <p className="aa-meta">
            Usual: {r.base?.pairs} pairs, {r.base?.people} people · With AI: {r.ai?.pairs} pairs, {r.ai?.people} people ·
            used: <b>{r.used === 'ai' ? 'AI' : 'usual'}</b> ({r.mode})
          </p>
          {(r.onlyAi || []).length > 0 && (
            <>
              <p className="aa-meta"><b>Only in the AI plan</b></p>
              <ul className="aa-roster-list">
                {r.onlyAi.map((p) => <li key={p.label} className="aa-meta">{pairLabel(p.label)}{(p.reasons || []).filter((x) => x.startsWith('AI')).map((x) => ` · ${x}`).join('')}</li>)}
              </ul>
            </>
          )}
          {(r.onlyBase || []).length > 0 && (
            <>
              <p className="aa-meta"><b>Only in the usual plan</b></p>
              <ul className="aa-roster-list">{r.onlyBase.map((p) => <li key={p.label} className="aa-meta">{pairLabel(p.label)}</li>)}</ul>
            </>
          )}
          {!(r.onlyAi || []).length && !(r.onlyBase || []).length && <p className="aa-meta">Both plans are the same.</p>}
        </section>
      ))}

      <section className="aa-panel">
        <h3 className="aa-h">Reports</h3>
        {reports === null && <p className="aa-empty">Loading…</p>}
        {reports && reports.length === 0 && <p className="aa-empty">No report yet. The first one comes the morning after you turn it on — or press Run now.</p>}
        {(reports || []).map((r) => (
          <article key={r.id} className="aa-panel">
            <p className="aa-meta"><b>{r.date ? dayMonth(r.date) : ''}</b> · week of {r.weekKey ? dayMonth(r.weekKey) : '—'}
              {r.usd != null ? ` · $${Number(r.usd).toFixed(4)}` : ''}{r.scored != null ? ` · ${r.scored} pairs scored` : ''}</p>
            {r.report && <p>{r.report}</p>}
            {r.lastError && <p className="aa-error">Last run failed: {r.lastError}</p>}
            {(r.flags || []).length > 0 && (
              <ul className="aa-roster-list">
                {r.flags.map((f) => (
                  <li key={f.uid} className="aa-roster-item">
                    <span className="aa-roster-main">
                      <span className="aa-name">{f.name || f.uid.slice(0, 6)}</span>
                      <span className="aa-meta">{f.why}</span>
                    </span>
                    <FlagButton id={f.uid} name={f.name || 'this account'} h={health.get(f.uid)} />
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
