import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { MessageCircle, AlertTriangle, Moon, TrendingDown, Info } from 'lucide-react';
import { db } from '../firebase';
import { ADMIN_UID } from '../constants';
import { subscribeToRecentAttendance, summarize } from '../utils/attendance';
import './AdminAttendance.css';

// Admin → Attendance: commitment (weeklyTarget from onboarding) against what
// actually happened, per learner, over four weeks.
//
// The learner's own misses (no-show, late cancel) and the PLATFORM's misses
// (partner did not come, no partner found) are counted apart. Only the first
// kind raises a flag against the learner — practice the platform could not
// deliver is not absence. The first step for any flag is a conversation,
// hence the chat button on every row.

const DAY = 86400000;
const toMs = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : Number(t) || 0);

function flagsFor(s, target, joinedMs, now) {
  const f = [];
  if (s.noShow + s.lateCancel >= 2) f.push({ id: 'misses', label: `${s.noShow + s.lateCancel} missed bookings`, Icon: AlertTriangle, tone: 'bad' });
  const settled = joinedMs && now - joinedMs > 14 * DAY;
  if (settled && (!s.lastAttendedMs || now - s.lastAttendedMs > 14 * DAY)) {
    f.push({ id: 'quiet', label: s.platformMissed ? 'No practice in 2 weeks — platform missed them too' : 'No practice in 2 weeks', Icon: Moon, tone: s.platformMissed ? 'soft' : 'bad' });
  }
  const [, w1, w2] = s.weeks;
  if (target && settled && s.attendedByWeek[w1] < target && s.attendedByWeek[w2] < target) {
    f.push({ id: 'below', label: 'Below target 2 weeks running', Icon: TrendingDown, tone: 'soft' });
  }
  return f;
}

export default function AdminAttendance({ users }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [onboarding, setOnboarding] = useState({});
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [now] = useState(Date.now());

  useEffect(() => subscribeToRecentAttendance(setEvents, now - 35 * DAY), [now]);
  useEffect(() => onSnapshot(collection(db, 'onboarding'), (snap) => {
    setOnboarding(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])));
  }, () => {}), []);

  const rows = useMemo(() => {
    const byUid = new Map();
    for (const e of events) {
      if (!byUid.has(e.uid)) byUid.set(e.uid, []);
      byUid.get(e.uid).push(e);
    }
    return (users || [])
      .map((u) => ({ ...u, uid: u.uid || u.id }))
      .filter((u) => u.role !== 'teacher' && u.uid !== ADMIN_UID && (onboarding[u.uid] || byUid.has(u.uid)))
      .map((u) => {
        const s = summarize(byUid.get(u.uid) || [], now);
        const ob = onboarding[u.uid] || {};
        const target = Number(ob.weeklyTarget) || 0;
        const joinedMs = toMs(ob.submittedAt) || toMs(u.createdAt);
        return { u, s, target, flags: flagsFor(s, target, joinedMs, now) };
      })
      .sort((a, b) => (b.flags.length - a.flags.length) || (b.s.thisWeek - a.s.thisWeek));
  }, [users, events, onboarding, now]);

  const shown = onlyFlagged ? rows.filter((r) => r.flags.length) : rows;
  const flagged = rows.filter((r) => r.flags.length).length;
  const weekDone = rows.filter((r) => r.target && r.s.thisWeek >= r.target).length;
  const withTarget = rows.filter((r) => r.target).length;

  return (
    <div className="at">
      <div className="at-summary">
        <div><b>{weekDone}/{withTarget}</b><span>on target this week</span></div>
        <div><b>{flagged}</b><span>need a conversation</span></div>
      </div>

      <p className="at-note">
        <Info size={14} /> “Platform missed” = the partner did not come, or no partner was found.
        It is shown, but it never counts against the learner.
      </p>

      <label className="at-toggle">
        <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Only learners with a flag
      </label>

      <ul className="at-list">
        {shown.map(({ u, s, target, flags }) => {
          const maxBar = Math.max(target, ...Object.values(s.attendedByWeek), 1);
          return (
            <li key={u.uid} className={`at-row ${flags.some((f) => f.tone === 'bad') ? 'is-bad' : ''}`}>
              <div className="at-top">
                <div className="at-who">
                  <b>{u.name || u.email || u.uid.slice(0, 6)}</b>
                  <span className="at-muted">
                    {target ? `Goal ${target === 4 ? '4+' : target}/week` : 'No goal set'} · this week {s.thisWeek}
                  </span>
                </div>
                <div className="at-bars" aria-label="Practices per week, oldest first">
                  {[...s.weeks].reverse().map((w) => {
                    const n = s.attendedByWeek[w];
                    return (
                      <span key={w} className="at-bar" title={`Week of ${w}: ${n}`}>
                        <span style={{ height: `${Math.round((n / maxBar) * 100)}%` }} className={target && n >= target ? 'is-met' : ''} />
                        <em>{n}</em>
                      </span>
                    );
                  })}
                </div>
                <button type="button" className="at-chat" onClick={() => navigate(`/chat/${u.uid}`)} aria-label={`Chat with ${u.name}`}>
                  <MessageCircle size={16} />
                </button>
              </div>
              <div className="at-chips">
                {s.noShow > 0 && <span className="at-chip is-bad">No-show {s.noShow}</span>}
                {s.lateCancel > 0 && <span className="at-chip is-bad">Late cancel {s.lateCancel}</span>}
                {s.cancelled > 0 && <span className="at-chip">Cancelled in time {s.cancelled}</span>}
                {s.platformMissed > 0 && <span className="at-chip is-platform">Platform missed {s.platformMissed}</span>}
                <span className="at-chip">
                  Last practice {s.lastAttendedMs ? new Date(s.lastAttendedMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                </span>
              </div>
              {flags.length > 0 && (
                <div className="at-flags">
                  {flags.map((f) => (
                    <span key={f.id} className={`at-flag is-${f.tone}`}><f.Icon size={14} /> {f.label}</span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="at-muted">Nothing to show.</li>}
      </ul>
    </div>
  );
}
