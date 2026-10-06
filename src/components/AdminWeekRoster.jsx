import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Copy, Search, UsersRound } from 'lucide-react';
import { db } from '../firebase';
import { ADMIN_UID } from '../constants';
import { LEVELS } from '../utils/onboarding';
import { Button } from './ui';
import './AdminApplicants.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const toMs = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : Number(t) || 0);
const levelShort = (lv) => LEVELS.find((l) => l.value === lv)?.short || (lv || '').slice(0, 2) || '—';
const dayMonth = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const prevMonday = (monday) => new Date(Date.parse(`${monday}T12:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
function seenLabel(ms, now) {
  if (!ms) return 'never seen';
  const d = Math.floor((now - ms) / DAY_MS);
  return d <= 0 ? 'seen today' : d === 1 ? 'seen yesterday' : `seen ${d} days ago`;
}

// Admin → Week → "Who practises": the people allowed into practice sessions
// that week (weekRoster/{monday}, functions/weekRoster.js). The weekly plan,
// joining a practice block and random matching are open only to them; with no
// list nobody is planned. Direct calls between two people are not affected.
//
// The list does NOT move while you work: it is sorted by name once, and
// ticking someone only changes their box. Nothing is saved until "Save", so a
// slip costs nothing; the planner reads the saved list on its next build.
export default function AdminWeekRoster({ week, users }) {
  const [mode, setMode] = useState(null);
  useEffect(() => onSnapshot(doc(db, 'appConfig', 'planner'),
    (s) => setMode(s.exists() && s.get('rosterMode') === 'auto' ? 'auto' : 'manual'), () => setMode('manual')), []);
  if (mode === null) return <section className="aa-panel"><p className="aa-empty">Loading…</p></section>;
  return mode === 'auto'
    ? <AutoRoster week={week} users={users} />
    : <ManualRoster week={week} users={users} />;
}

// The switch between the admin's list and the autopilot. Turning the
// autopilot on changes who gets planned from the next planner run.
function ModeSwitch({ auto }) {
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    const msg = auto
      ? 'Back to the manual list? Only the people you tick will be planned again.'
      : 'Turn the autopilot on? Everyone who says "I\'m in" for the week (or has a package) and opened the app in the last 7 days is planned. Your list becomes an Always / Never override.';
    if (!window.confirm(msg)) return;
    setBusy(true);
    await setDoc(doc(db, 'appConfig', 'planner'), { rosterMode: auto ? 'manual' : 'auto' }, { merge: true }).catch((e) => window.alert(e.message));
    setBusy(false);
  };
  return (
    <div className="aa-mode" role="group" aria-label="Who decides">
      <button type="button" className={`aa-chip ${!auto ? 'is-on' : ''}`} disabled={busy || !auto} onClick={flip}>Manual list</button>
      <button type="button" className={`aa-chip ${auto ? 'is-on' : ''}`} disabled={busy || auto} onClick={flip}>Autopilot</button>
    </div>
  );
}

const WHY = {
  said_in: 'said "in"', package: 'package', new: 'new this week', included: 'always (you)',
  excluded: 'never (you)', asleep: 'not seen 7+ days', not_confirmed: 'did not say "in"', skipped: 'week off',
  snoozed: '2 proposals ignored', no_practices_left: 'no practices left', not_set_up: 'not set up', paused: 'paused',
};

// Autopilot: the server decides (functions/autoRoster.js) and writes its
// verdicts to weekRoster/{monday}.autoWhy on every plan/refill run. The admin
// only overrides: Always (include) or Never (exclude). Nothing moves while
// you work — sorted by name once.
function AutoRoster({ week, users }) {
  const [docData, setDocData] = useState(undefined);
  const [onboarding, setOnboarding] = useState([]);
  const [draft, setDraft] = useState(null); // Map uid → 'in' | 'out' (absent = auto)
  const [filter, setFilter] = useState('All');
  const [state, setState] = useState('');
  useEffect(() => {
    setDocData(undefined); setDraft(null);
    return onSnapshot(doc(db, 'weekRoster', week), (s) => setDocData(s.exists() ? s.data() : {}), () => setDocData({}));
  }, [week]);
  useEffect(() => onSnapshot(collection(db, 'onboarding'),
    (snap) => setOnboarding(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setOnboarding([])), []);
  useEffect(() => {
    if (docData === undefined || draft !== null) return;
    const m = new Map();
    for (const u of docData.include || []) m.set(u, 'in');
    for (const u of docData.exclude || []) m.set(u, 'out');
    setDraft(m);
  }, [docData, draft]);
  const now = Date.now();
  const people = useMemo(() => {
    const byUid = new Map((users || []).map((u) => [u.uid || u.id, u]));
    return onboarding
      .map((o) => { const u = byUid.get(o.id) || {}; return { id: o.id, name: u.name || o.id.slice(0, 6), level: u.level || o.level, seen: toMs(u.lastSeen), role: u.role }; })
      .filter((p) => p.id !== ADMIN_UID && p.role !== 'teacher')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, onboarding]);
  if (docData === undefined || draft === null) return <section className="aa-panel"><p className="aa-empty">Loading…</p></section>;
  const why = docData.autoWhy || {};
  const sum = docData.autoSummary || null;
  const inSet = new Set(docData.autoIn || []);
  const shown = people.filter((p) => filter === 'All' || (filter === 'In' ? inSet.has(p.id) : !inSet.has(p.id)));
  const savedKey = JSON.stringify([...(docData.include || [])].sort()) + JSON.stringify([...(docData.exclude || [])].sort());
  const draftIn = [...draft].filter(([, v]) => v === 'in').map(([u]) => u).sort();
  const draftOut = [...draft].filter(([, v]) => v === 'out').map(([u]) => u).sort();
  const dirty = savedKey !== JSON.stringify(draftIn) + JSON.stringify(draftOut);
  const set = (id, v) => setDraft((cur) => { const n = new Map(cur); if (v === 'auto') n.delete(id); else n.set(id, v); return n; });
  const save = async () => {
    setState('saving');
    try {
      await setDoc(doc(db, 'weekRoster', week), { include: draftIn, exclude: draftOut, updatedAt: serverTimestamp(), updatedBy: ADMIN_UID }, { merge: true });
      setState('saved');
    } catch (e) { setState(`Not saved: ${e.code || e.message}`); }
  };
  const reasons = sum ? Object.entries(sum.why || {}).filter(([k]) => !['said_in', 'package', 'new', 'included'].includes(k)) : [];
  return (
    <section className="aa-panel aa-roster">
      <h3 className="aa-h"><UsersRound size={16} /> Who practises · week of {dayMonth(week)}</h3>
      <ModeSwitch auto />
      <p className="aa-meta">
        {sum
          ? <><b>Autopilot · {sum.in} in</b>{reasons.length ? ` · out: ${reasons.map(([k, n]) => `${n} ${WHY[k] || k}`).join(', ')}` : ''}{docData.autoAt ? ` · checked ${new Date(docData.autoAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</>
          : 'Autopilot · this week has not been checked yet — the next plan or refill run decides.'}
      </p>
      <div className="aa-filters">
        {['All', 'In', 'Out'].map((f) => (
          <button key={f} type="button" className={`aa-chip ${filter === f ? 'is-on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <ul className="aa-roster-list">
        {shown.map((p) => {
          const v = draft.get(p.id) || 'auto';
          return (
            <li key={p.id} className={`aa-roster-row ${inSet.has(p.id) ? 'is-on' : ''}`}>
              <span className="aa-roster-main">
                <span className="aa-name">{p.name} <span className="aa-level">{levelShort(p.level)}</span></span>
                <span className="aa-meta">{WHY[why[p.id]] || '—'} · {seenLabel(p.seen, now)}</span>
              </span>
              <span className="aa-tri" role="group" aria-label={`${p.name}: override`}>
                {[['auto', 'Auto'], ['in', 'Always'], ['out', 'Never']].map(([k, label]) => (
                  <button key={k} type="button" className={`aa-chip aa-chip--sm ${v === k ? 'is-on' : ''}`} onClick={() => set(p.id, k)}>{label}</button>
                ))}
              </span>
            </li>
          );
        })}
        {shown.length === 0 && <li className="aa-empty">Nobody here.</li>}
      </ul>
      <div className="aa-sticky-bar">
        <span className="aa-sticky-count">{draftIn.length} always · {draftOut.length} never{dirty ? ' · not saved' : ''}</span>
        <Button size="sm" disabled={!dirty || state === 'saving'} onClick={save}>{state === 'saving' ? 'Saving…' : 'Save'}</Button>
      </div>
      {state && state !== 'saving' && <p className={state === 'saved' ? 'aa-ok' : 'aa-error'} role="status">{state === 'saved' ? 'Saved. The next planner run uses it.' : state}</p>}
    </section>
  );
}

function ManualRoster({ week, users }) {
  const [saved, setSaved] = useState(undefined);
  const [prev, setPrev] = useState(null);
  const [draft, setDraft] = useState(null);
  const [onboarding, setOnboarding] = useState([]);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All');
  const [state, setState] = useState('');
  const [carriedFrom, setCarriedFrom] = useState(null);

  useEffect(() => {
    setSaved(undefined); setDraft(null); setState('');
    return onSnapshot(doc(db, 'weekRoster', week),
      (snap) => { setSaved(snap.exists() ? (snap.get('uids') || []) : null); setCarriedFrom(snap.exists() ? snap.get('carriedFrom') || null : null); },
      () => setSaved(null));
  }, [week]);
  useEffect(() => onSnapshot(doc(db, 'weekRoster', prevMonday(week)),
    (snap) => setPrev(snap.exists() ? (snap.get('uids') || []) : null), () => setPrev(null)), [week]);
  useEffect(() => onSnapshot(collection(db, 'onboarding'),
    (snap) => setOnboarding(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setOnboarding([])), []);

  // Start editing from what is saved (once it has loaded).
  useEffect(() => { if (saved !== undefined && draft === null) setDraft(new Set(saved || [])); }, [saved, draft]);

  const now = Date.now();
  const people = useMemo(() => {
    const byUid = new Map((users || []).map((u) => [u.uid || u.id, u]));
    const ids = new Set([...onboarding.map((o) => o.id), ...(saved || [])]);
    const obById = new Map(onboarding.map((o) => [o.id, o]));
    return [...ids]
      .map((id) => {
        const u = byUid.get(id) || {};
        const ob = obById.get(id) || {};
        return {
          id,
          name: u.name || u.email || id.slice(0, 6),
          email: u.email || '',
          level: u.level || ob.level,
          wants: Number(ob.weeklyTarget) || 0,
          seen: toMs(u.lastSeen),
          role: u.role,
        };
      })
      .filter((p) => p.id !== ADMIN_UID && p.role !== 'teacher')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, onboarding, saved]);

  const shown = people
    .filter((p) => level === 'All' || levelShort(p.level) === level)
    .filter((p) => !search.trim() || `${p.name} ${p.email}`.toLowerCase().includes(search.trim().toLowerCase()));

  if (saved === undefined || draft === null) return <section className="aa-panel"><p className="aa-empty">Loading the list…</p></section>;

  const toggle = (id) => setDraft((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const dirty = (saved || []).length !== draft.size || (saved || []).some((u) => !draft.has(u));
  const save = async () => {
    setState('saving');
    // setDoc resolves only when the server confirms. On a weak phone
    // connection that can take minutes, and the button sat on "Saving…" as if
    // frozen (Polad, 2026-10-04). The write is already queued on the phone,
    // so after a few seconds say so instead of waiting in silence.
    const slow = setTimeout(() => setState((s) => (s === 'saving' ? 'sending' : s)), 5000);
    try {
      await setDoc(doc(db, 'weekRoster', week), { uids: [...draft], updatedAt: serverTimestamp(), updatedBy: ADMIN_UID });
      clearTimeout(slow);
      setState('saved');
    } catch (e) {
      clearTimeout(slow);
      console.error('[AdminWeekRoster]', e);
      setState('Not saved.');
    }
  };

  return (
    <section className="aa-panel aa-roster">
      <h3 className="aa-h"><UsersRound size={16} /> Who practises · week of {dayMonth(week)}</h3>
      <ModeSwitch auto={false} />
      <p className="aa-meta">
        Only the people ticked here are planned, can join a practice block and can be matched at random.
        {/* No saved list: the server uses the most recent list of the last four
            weeks (functions rosterOf), so a missed Sunday stops nobody. */}
        {saved === null && (prev && prev.length
          ? <b> No list saved — last week's list ({prev.length} people) is used automatically.</b>
          : <b> No list yet — nobody is planned for that week.</b>)}
        {carriedFrom && <b> Carried over from the week of {dayMonth(carriedFrom)} — edit if needed.</b>}
      </p>

      <div className="aa-filters">
        <label className="aa-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {['All', ...LEVELS.map((l) => l.short)].map((l) => (
          <button key={l} type="button" className={`aa-chip ${level === l ? 'is-on' : ''}`} onClick={() => setLevel(l)}>{l}</button>
        ))}
      </div>

      <ul className="aa-roster-list">
        {shown.map((p) => (
          <li key={p.id}>
            <label className={`aa-roster-row ${draft.has(p.id) ? 'is-on' : ''}`}>
              <input type="checkbox" className="aa-check" checked={draft.has(p.id)} onChange={() => toggle(p.id)} />
              <span className="aa-roster-main">
                <span className="aa-name">{p.name} <span className="aa-level">{levelShort(p.level)}</span></span>
                <span className="aa-meta">{p.wants ? `wants ${p.wants}/week` : 'no weekly target'} · {seenLabel(p.seen, now)}</span>
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="aa-empty">Nobody matches.</li>}
      </ul>

      <div className="aa-sticky-bar">
        <span className="aa-sticky-count">{draft.size} selected{dirty ? ' · not saved' : ''}</span>
        {prev && prev.length > 0 && (
          <Button size="sm" variant="ghost" icon={<Copy size={16} aria-hidden="true" />} onClick={() => setDraft(new Set(prev))}>Last week</Button>
        )}
        {draft.size > 0 && <Button size="sm" variant="ghost" onClick={() => setDraft(new Set())}>Clear</Button>}
        <Button size="sm" disabled={!dirty || state === 'saving' || state === 'sending'} onClick={save}>{state === 'saving' || state === 'sending' ? 'Saving…' : 'Save'}</Button>
      </div>
      {state === 'sending' && <p className="aa-meta" role="status">Saved on this phone — still reaching the server. Keep the page open.</p>}
      {state && state !== 'saving' && state !== 'sending' && <p className={state === 'saved' ? 'aa-ok' : 'aa-error'} role="status">{state === 'saved' ? 'Saved. Rebuild the plan to use it.' : state}</p>}
    </section>
  );
}
