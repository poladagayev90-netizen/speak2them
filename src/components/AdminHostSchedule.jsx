import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { CalendarClock, Check, ChevronDown } from 'lucide-react';
import { db } from '../firebase';
import { ADMIN_UID } from '../constants';
import { Button } from './ui';
import TimeGrid from './plan/TimeGrid';
import './AdminHostSchedule.css';

// Baku weekdays (0 = Sunday, Monday first for the grid).
const COLUMNS = [
  { key: '1', label: 'Mon' },
  { key: '2', label: 'Tue' },
  { key: '3', label: 'Wed' },
  { key: '4', label: 'Thu' },
  { key: '5', label: 'Fri' },
  { key: '6', label: 'Sat' },
  { key: '0', label: 'Sun' },
];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07–23 Baku

function entryToSet(hoursMap) {
  const s = new Set();
  for (const [wd, list] of Object.entries(hoursMap || {})) {
    for (const h of Array.isArray(list) ? list : []) {
      const n = Number(h);
      if (Number.isInteger(n) && n >= 7 && n <= 23) s.add(`${wd}-${n}`);
    }
  }
  return s;
}

function setToHoursMap(cellSet) {
  const out = {};
  for (const key of cellSet) {
    const [wd, hStr] = key.split('-');
    const h = Number(hStr);
    if (!Number.isInteger(h)) continue;
    if (!out[wd]) out[wd] = [];
    out[wd].push(h);
  }
  for (const wd of Object.keys(out)) out[wd].sort((a, b) => a - b);
  return out;
}

// Admin → Matching: Polad's free Baku hours for automatic first-match booking
// (appConfig/planner.newcomerHosts). Keeps any other configured Verified
// Partners intact while updating the admin host entry + caps.
export default function AdminHostSchedule() {
  const [open, setOpen] = useState(false);
  const [rawHosts, setRawHosts] = useState([]);
  const [cells, setCells] = useState(() => new Set());
  const [maxPerDay, setMaxPerDay] = useState(2);
  const [minLeadHours, setMinLeadHours] = useState(2);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }

  useEffect(() => onSnapshot(doc(db, 'appConfig', 'planner'), (snap) => {
    const d = snap.exists() ? (snap.data() || {}) : {};
    const list = Array.isArray(d.newcomerHosts) ? d.newcomerHosts : [];
    setRawHosts(list);
    const mine = list.find((e) => (typeof e === 'string' ? e === ADMIN_UID : e && e.uid === ADMIN_UID));
    if (mine && typeof mine === 'object') {
      setCells(entryToSet(mine.hours));
      if (Number(mine.maxPerDay) > 0) setMaxPerDay(Math.min(6, Math.max(1, Number(mine.maxPerDay))));
      if (Number(mine.minLeadHours) > 0) setMinLeadHours(Math.min(12, Math.max(1, Number(mine.minLeadHours))));
    } else {
      setCells(new Set());
    }
  }, () => {}), []);

  const totalHours = cells.size;
  const otherHostsCount = useMemo(
    () => rawHosts.filter((e) => (typeof e === 'string' ? e !== ADMIN_UID : e && e.uid && e.uid !== ADMIN_UID)).length,
    [rawHosts],
  );

  const toggle = (wd, h) => {
    setStatus(null);
    setCells((prev) => {
      const next = new Set(prev);
      const k = `${wd}-${h}`;
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const others = rawHosts.filter((e) => (typeof e === 'string' ? e !== ADMIN_UID : e && e.uid && e.uid !== ADMIN_UID));
      const hours = setToHoursMap(cells);
      const adminEntry = {
        uid: ADMIN_UID,
        hours,
        maxPerDay: Math.min(6, Math.max(1, Number(maxPerDay) || 2)),
        minLeadHours: Math.min(12, Math.max(1, Number(minLeadHours) || 2)),
        label: 'Polad · SpeakLab team',
        isFounder: true,
      };
      const newcomerHosts = Object.keys(hours).length ? [adminEntry, ...others] : others;
      await setDoc(doc(db, 'appConfig', 'planner'), {
        newcomerHosts,
        hostScheduleUpdatedAt: serverTimestamp(),
      }, { merge: true });
      setStatus({ ok: true, text: `Saved ${totalHours} Baku hours · max ${adminEntry.maxPerDay}/day · ${adminEntry.minLeadHours}h notice.` });
    } catch (e) {
      setStatus({ ok: false, text: 'Could not save host hours. Try again.' });
    }
    setSaving(false);
  };

  return (
    <section className={`aa-panel hs ${open ? 'is-open' : ''}`} aria-label="First-match host schedule">
      <button type="button" className="hs-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="hs-head-main">
          <span className="aa-h">
            <CalendarClock size={18} aria-hidden="true" /> First-match host hours (Polad)
          </span>
          <span className="aa-meta">
            {totalHours > 0
              ? `${totalHours} Baku hrs/week · max ${maxPerDay}/day · ${minLeadHours}h notice`
              : 'Not set yet — tap Edit to paint your free hours'}
            {otherHostsCount > 0 ? ` · +${otherHostsCount} Verified Partner${otherHostsCount === 1 ? '' : 's'}` : ''}
          </span>
        </span>
        <span className="hs-toggle">
          {open ? 'Hide' : 'Edit'}
          <ChevronDown size={16} className="hs-chev" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="hs-body">
          <p className="aa-meta">
            Tap every Baku hour when newcomers may be automatically booked with you right after onboarding.
          </p>
          <div className="hs-controls">
            <label className="hs-field">
              <span>Max newcomers / day</span>
              <select value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} / day</option>)}
              </select>
            </label>
            <label className="hs-field">
              <span>Minimum notice</span>
              <select value={minLeadHours} onChange={(e) => setMinLeadHours(Number(e.target.value))}>
                {[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{n} h ahead</option>)}
              </select>
            </label>
          </div>
          <TimeGrid
            compact
            columns={COLUMNS}
            hours={HOURS}
            ariaLabel="Admin host free hours in Baku time"
            cell={(wd, h) => ({ on: cells.has(`${wd}-${h}`) })}
            onToggle={toggle}
          />
          <div className="hs-foot">
            <Button size="sm" icon={<Check size={16} aria-hidden="true" />} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save host hours'}
            </Button>
            {totalHours > 0 && (
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setCells(new Set())}>
                Clear all
              </Button>
            )}
          </div>
          {status && <p className={status.ok ? 'aa-ok' : 'aa-error'} role="status">{status.text}</p>}
        </div>
      )}
    </section>
  );
}
