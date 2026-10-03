import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { useBillingConfig } from '../hooks/usePackages';

// Admin → Students: packages (functions/packages.js, adminAccess).
// Until Google Play payments exist the admin hands packages out here after a
// learner asks on WhatsApp; "Make Pro" next to it stays the way to give
// unlimited practice.

const callAccess = async (body) => {
  const res = await authedFetch(`${FUNCTIONS_BASE}/adminAccess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

// Everyone's balance as the server last worked it out (planStatus/{uid}.access).
export function usePackageSummaries() {
  const [map, setMap] = useState({});
  useEffect(() => onSnapshot(collection(db, 'planStatus'), (snap) => {
    const next = {};
    snap.docs.forEach((d) => { const a = d.get('access'); if (a) next[d.id] = a; });
    setMap(next);
  }, () => setMap({})), []);
  return map;
}

export function packageLabel(a) {
  if (!a) return null;
  if (a.kind === 'package') return `${a.remaining}/${a.total} left · ${new Date(a.periodEndMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  if (a.kind === 'trial') return `free month · ${a.remaining} left this week`;
  if (a.kind === 'none') return 'no package';
  return null;
}

// The switch that makes the limits real. Off: everything is counted and shown,
// nobody is refused. Turning it on starts everyone's free month from today if
// theirs already ran out (packages.trialWindow), so nobody is cut off at once.
export function BillingSwitch() {
  const { config, loaded } = useBillingConfig();
  const [busy, setBusy] = useState(false);
  if (!loaded) return null;
  const flip = async () => {
    const on = !config.enforce;
    const msg = on
      ? 'Turn packages ON? Planned practice will need the free month or a package. Learners whose free month already ended get four free weeks from today.'
      : 'Turn packages OFF? Nobody will be refused; balances keep being counted.';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const r = await callAccess({ action: 'setEnforce', on });
      alert(`Packages are ${r.enforce ? 'ON' : 'OFF'} (${r.refreshed} balances refreshed).`);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`adm-billing ${config.enforce ? 'is-on' : ''}`}>
      <div>
        <p className="adm-billing-title">Packages {config.enforce ? 'ON' : 'OFF'}</p>
        <p className="adm-billing-sub">
          {config.enforce
            ? 'Planned practice needs the free month or a package.'
            : 'Counted and shown only — nobody is refused.'}
          {' '}{config.packages.map((p) => `${p.size}=${p.price}`).join(' · ')} {config.currency}
        </p>
      </div>
      <button type="button" className={`adm-btn ${config.enforce ? 'adm-btn--danger' : ''}`} disabled={busy} onClick={flip}>
        {busy ? '…' : config.enforce ? 'Turn off' : 'Turn on'}
      </button>
    </div>
  );
}

// A small menu on a learner's row: give 8/12/16/20, or take the package away.
export function PackageMenu({ uid, summary }) {
  const { config } = useBillingConfig();
  const [busy, setBusy] = useState(false);
  const onChange = async (e) => {
    const v = e.target.value;
    e.target.value = '';
    if (!v) return;
    const body = v === 'revoke' ? { action: 'revoke', uid } : { action: 'grant', uid, size: Number(v) };
    const ask = v === 'revoke' ? 'Remove this learner\'s package?' : `Give a ${v}-practice package (30 days, starting now)?`;
    if (!window.confirm(ask)) return;
    setBusy(true);
    try {
      await callAccess(body);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <select className="adm-btn adm-select" defaultValue="" disabled={busy} onChange={onChange} aria-label="Package">
      <option value="">{busy ? '…' : 'Package'}</option>
      {config.packages.map((p) => <option key={p.size} value={p.size}>Give {p.size}</option>)}
      {summary && summary.kind === 'package' && <option value="revoke">Remove package</option>}
    </select>
  );
}
