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
  if (a.kind === 'trial') return `free · ${a.remaining} of ${a.freeTotal || 3} left`;
  if (a.kind === 'none') return 'no package';
  return null;
}

// The switch that makes the limits real. Off: everything is counted and shown,
// nobody is refused. Turning it on counts everyone's 3 free practices from
// today (packages.trialWindow), so nobody is cut off at once.
export function BillingSwitch() {
  const { config, loaded } = useBillingConfig();
  const [busy, setBusy] = useState(false);
  if (!loaded) return null;
  const flip = async () => {
    const on = !config.enforce;
    const msg = on
      ? 'Turn packages ON? Planned practice will need a free practice or a package. Everyone gets 3 free planned practices counted from today.'
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
            ? 'Planned practice needs a free practice (3) or a package.'
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

// Suspend / restore an account (adminAccess suspend|unsuspend): the person can
// no longer sign in, is never paired, and their upcoming practices and open
// proposals are cancelled (partners are told). Restore lets them back in;
// nothing was deleted.
export function SuspendButton({ uid, name, suspended }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    let body;
    if (suspended) {
      if (!window.confirm(`Restore ${name || 'this account'}? They can sign in and be planned again.`)) return;
      body = { action: 'unsuspend', uid };
    } else {
      const reason = window.prompt(`Suspend ${name || 'this account'}?
They are signed out, cannot sign in, and their upcoming practices are cancelled.

Reason (only the team sees it):`, '');
      if (reason === null) return;
      body = { action: 'suspend', uid, reason };
    }
    setBusy(true);
    try {
      const r = await callAccess(body);
      if (r.suspended) alert(`Suspended. Cancelled: ${r.cancelledBookings} practice(s), ${r.cancelledOffers} proposal(s).`);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={`adm-btn ${suspended ? 'adm-btn--soft' : 'adm-btn--danger'}`} disabled={busy} onClick={run}>
      {busy ? '…' : suspended ? 'Restore account' : 'Suspend'}
    </button>
  );
}
