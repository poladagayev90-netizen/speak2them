import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { AudioLines } from 'lucide-react';
import { db } from '../firebase';
import { Button } from './ui';
import './AdminApplicants.css';

// Admin → Agent → «Analysis shadow» (functions/analysisShadow.js). While the
// switch is on, every call analysis is ALSO sent to Gemini 3.8 Flash, which
// hears the recording; the learner still gets the usual report and never sees
// this one. Here the two sit side by side, plus the three sections only a
// model that hears the voice can give (Polad's pick, 2026-10-14). Decide from
// ~20 calls whether the analysis moves to Gemini.

const bakuMonth = (ms) => new Date(ms + 4 * 60 * 60 * 1000).toISOString().slice(0, 7);
const when = (ts) => (ts?.toDate ? ts.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const sign = (n) => (n == null ? '—' : n > 0 ? `+${n}` : String(n));

function useNames(ids) {
  const [names, setNames] = useState({});
  const key = ids.join(',');
  useEffect(() => {
    let live = true;
    Promise.all(ids.map((id) => getDoc(doc(db, 'users', id)).then((s) => [id, s.exists() ? s.data().name : ''], () => [id, ''])))
      .then((rows) => { if (live) setNames(Object.fromEntries(rows)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return names;
}

const fixesOf = (a) => (a?.errorThemes || []).flatMap((t) => (t.items || []).map((i) => ({ ...i, tag: t.title })));

function Side({ title, a }) {
  const s = a?.scores || {};
  const fixes = fixesOf(a);
  return (
    <div className="aa-compare-col">
      <p className="aa-meta"><b>{title}</b></p>
      <p className="aa-meta">Fluency {s.fluency ?? '—'} · Grammar {s.grammar ?? '—'} · Vocabulary {s.vocabulary ?? '—'}</p>
      {fixes.length === 0 && <p className="aa-meta">No fixes.</p>}
      <ul className="aa-roster-list">
        {fixes.map((f, i) => (
          <li key={i} className="aa-shadow-fix">
            <span className="aa-meta">{f.tag}</span>
            <span className="aa-shadow-wrong">✗ {f.original}</span>
            <span>✓ {f.corrected}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShadowRow({ d, name }) {
  const [open, setOpen] = useState(false);
  const [showText, setShowText] = useState(false);
  const c = d.compare || {};
  const x = d.extras || {};
  return (
    <article className="aa-panel">
      <button type="button" className="aa-shadow-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="aa-name">{name || d.userId?.slice(0, 6)}</span>
        <span className="aa-meta">
          {when(d.at)} · {Math.round((d.analyzedSeconds || 0) / 60)} min
          {d.lastError ? ' · failed' : ` · fixes ${c.mainFixes ?? '—'} → ${c.shadowFixes ?? '—'} (same ${c.sameFixes ?? 0}) · fluency ${sign(c.scoreDelta?.fluency)} · $${Number(d.usd || 0).toFixed(3)}`}
        </span>
      </button>
      {open && d.lastError && <p className="aa-error">{d.lastError}</p>}
      {open && !d.lastError && (
        <>
          <div className="aa-compare">
            <Side title="Now (Deepgram + DeepSeek)" a={d.main} />
            <Side title="Gemini (hears the audio)" a={d.analysis} />
          </div>
          <p className="aa-meta aa-shadow-label"><b>Only Gemini · How you sounded</b></p>
          {x.delivery ? (
            <>
              {(x.delivery.fillers || []).length > 0 && <p className="aa-meta">Fillers: {x.delivery.fillers.map((f) => `«${f.word}» ×${f.count}`).join(', ')}</p>}
              {(x.delivery.hesitation || []).map((h, i) => <p key={i} className="aa-meta">→ {h}</p>)}
              {x.delivery.smoothest && <p className="aa-meta">+ {x.delivery.smoothest}</p>}
            </>
          ) : <p className="aa-meta">—</p>}
          <p className="aa-meta aa-shadow-label"><b>Only Gemini · Say it right</b></p>
          {(x.pronunciation || []).length ? x.pronunciation.map((p, i) => (
            <p key={i} className="aa-meta">{p.word} — heard «{p.heard}»{p.times > 1 ? ` ×${p.times}` : ''} · {p.tip}</p>
          )) : <p className="aa-meta">Nothing clearly wrong.</p>}
          <p className="aa-meta aa-shadow-label"><b>Only Gemini · Your best moment</b></p>
          {x.bestMoment ? <p className="aa-meta">«{x.bestMoment.quote}» — {x.bestMoment.why}</p> : <p className="aa-meta">—</p>}
          <p className="aa-meta">{c.mainWords ?? 0} words heard now · {c.shadowWords ?? 0} by Gemini · {Math.round((d.latencyMs || 0) / 1000)} s · {d.inputTokens} in / {d.outputTokens} out</p>
          <Button size="sm" variant="ghost" onClick={() => setShowText((v) => !v)}>{showText ? 'Hide transcripts' : 'Show transcripts'}</Button>
          {showText && (
            <div className="aa-compare">
              <p className="aa-meta aa-compare-col">{d.main?.transcript || '—'}</p>
              <p className="aa-meta aa-compare-col">{d.analysis?.transcript || '—'}</p>
            </div>
          )}
        </>
      )}
    </article>
  );
}

export default function AdminAnalysisShadow() {
  const [cfg, setCfg] = useState(undefined);
  const [usage, setUsage] = useState(null);
  const [rows, setRows] = useState(null);
  const [budget, setBudget] = useState('');
  const [state, setState] = useState('');
  useEffect(() => onSnapshot(doc(db, 'appConfig', 'analysis'), (s) => setCfg(s.exists() ? s.data() : null), () => setCfg(null)), []);
  useEffect(() => onSnapshot(doc(db, 'agentUsage', bakuMonth(Date.now())), (s) => setUsage(s.exists() ? s.data() : null), () => setUsage(null)), []);
  useEffect(() => onSnapshot(query(collection(db, 'callAnalysisShadow'), orderBy('at', 'desc'), limit(30)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setRows([])), []);
  useEffect(() => { if (cfg !== undefined) setBudget(String(cfg?.shadowMonthlyUsd ?? 3)); }, [cfg]);
  const names = useNames([...new Set((rows || []).map((r) => r.userId).filter(Boolean))]);

  if (cfg === undefined) return null;
  const on = cfg?.shadowGemini === true;
  const limitUsd = Number(cfg?.shadowMonthlyUsd ?? 3);
  const spent = Number(usage?.shadowUsd || 0);
  const save = async (patch) => {
    setState('');
    await setDoc(doc(db, 'appConfig', 'analysis'), patch, { merge: true }).catch((e) => setState(`Not saved: ${e.code || e.message}`));
  };

  return (
    <section className="aa-panel">
      <h3 className="aa-h"><AudioLines size={16} /> Analysis shadow</h3>
      <p className="aa-meta">
        When on, each call analysis is also sent to Gemini, which hears the recording. Learners keep the usual report;
        this one is only shown here, next to it.
      </p>
      <div className="aa-mode" role="group" aria-label="Analysis shadow">
        <button type="button" className={`aa-chip ${!on ? 'is-on' : ''}`} onClick={() => save({ shadowGemini: false })}>Off</button>
        <button type="button" className={`aa-chip ${on ? 'is-on' : ''}`} onClick={() => save({ shadowGemini: true })}>Shadow</button>
      </div>
      <div className="aa-filters">
        <label className="aa-search aa-budget">
          <span className="aa-meta">$/month</span>
          <input type="number" min="0" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Shadow monthly budget in dollars" />
        </label>
        <Button size="sm" variant="ghost" disabled={Number(budget) === limitUsd || !(Number(budget) >= 0)} onClick={() => save({ shadowMonthlyUsd: Number(budget) })}>Save budget</Button>
      </div>
      <p className="aa-meta">
        This month: <b>${spent.toFixed(3)}</b> of ${limitUsd.toFixed(2)} · {usage?.shadowCalls || 0} analyses
        {on && spent >= limitUsd ? ' · budget reached, paused until next month' : ''}
      </p>
      {state && <p className="aa-error" role="status">{state}</p>}
      {rows && rows.length === 0 && <p className="aa-empty">Nothing yet. The next call analysis after you turn it on shows up here.</p>}
      {(rows || []).map((d) => <ShadowRow key={d.id} d={d} name={names[d.userId]} />)}
    </section>
  );
}
