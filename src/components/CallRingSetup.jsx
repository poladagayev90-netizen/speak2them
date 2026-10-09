import React, { useCallback, useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { PhoneCall, Check, ChevronRight } from 'lucide-react';
import { Button } from './ui';
import { callSetupStatus, callSetupSteps, callSetupBroken, openCallSetting } from '../utils/callSetup';
import './plan/plan.css';

// «Calls reach you even when the phone sleeps» — the Android app's checklist
// (utils/callSetup.js). A sleeping phone gets the call push either way; these
// phone settings decide whether it rings, wakes the screen and survives the
// battery saver, like WhatsApp. Each row opens the exact settings page and the
// list re-reads itself when the person comes back to the app.
//
// variant 'today': only when something is off, with «Later» (3 days).
// variant 'profile': always (on Android), as the place to check.
const LATER_MS = 3 * 24 * 60 * 60 * 1000;

export default function CallRingSetup({ uid, variant = 'profile' }) {
  const [status, setStatus] = useState(null);
  const key = `callSetupLater:${uid}`;
  const [later, setLater] = useState(() => {
    if (variant !== 'today') return false;
    try { return Number(localStorage.getItem(key)) > Date.now(); } catch { return false; }
  });

  const refresh = useCallback(() => { callSetupStatus().then(setStatus); }, []);
  useEffect(() => {
    refresh();
    let handle;
    App.addListener('resume', refresh).then((h) => { handle = h; }).catch(() => {});
    return () => { handle?.remove?.(); };
  }, [refresh]);

  if (!status) return null;
  const steps = callSetupSteps(status);
  const broken = callSetupBroken(status);
  if (variant === 'today' && (later || !broken)) return null;

  const putOff = () => {
    try { localStorage.setItem(key, String(Date.now() + LATER_MS)); } catch { /* private mode */ }
    setLater(true);
  };

  return (
    <section className="pl-card crs" aria-label="Calls when the phone sleeps">
      <div className="crs-head">
        <span className="pl-row-icon" aria-hidden="true"><PhoneCall size={18} /></span>
        <div>
          <p className="pl-row-title">{broken ? 'Let calls wake your phone' : 'Calls ring even when the phone sleeps'}</p>
          <p className="mr-sub">
            {broken
              ? 'A few phone settings, once — then a partner\'s call rings like WhatsApp, even with the screen off.'
              : 'Everything is set. A partner\'s call rings and lights up the screen.'}
          </p>
        </div>
      </div>
      <ul className="crs-list">
        {steps.map((s) => (
          <li key={s.id}>
            <button type="button" className={`crs-row ${s.ok ? 'is-ok' : ''}`} onClick={() => openCallSetting(s.id)}>
              <span className={`crs-dot ${s.ok === false ? 'is-off' : ''}`} aria-hidden="true">
                {s.ok ? <Check size={14} /> : null}
              </span>
              <span className="crs-main">
                <span className="crs-title">{s.title}</span>
                {s.ok !== true && <span className="crs-fix">{s.fix}</span>}
              </span>
              {s.ok !== true && <ChevronRight size={16} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
      {variant === 'today' && (
        <div className="wp-card-actions">
          <Button size="sm" variant="ghost" onClick={putOff}>Later</Button>
        </div>
      )}
    </section>
  );
}
