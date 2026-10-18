import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import {
  ArrowLeftRight, CalendarCheck, CalendarClock, Check, ChevronDown, Clock, MessageCircle, Plus, RotateCcw, Search, Send, Sparkles, Trash2, UserPlus, X,
} from 'lucide-react';
import { db } from '../firebase';
import { ADMIN_UID } from '../constants';
import { LEVELS, whatsAppLink } from '../utils/onboarding';
import { toBakuIntervals, overlapAll, offsetVsBaku, formatMinutes, cityOf } from '../utils/timezone';
import { proposeMatch, cancelOffer, subscribeToWeekPlan, weekPlanAction } from '../utils/matchOffers';
import { cancelSlotMatch } from '../utils/teacher';
import {
  PROPOSE_HORIZON_DAYS, closedOffers, weekStarts, startFitMin, busyAround, weekPairs, plannedCount, candidatesFor, levelGap, addDays, START_FIT_MIN,
  freeGrid, attentionOf, ATTENTION,
} from '../utils/matching';
import { isUnlimited } from '../utils/packages';
import { ApplicantDetail } from './AdminApplicants';
import { useAccountHealth } from './AdminWeekRoster';
import { usePackageSummaries } from './AdminPackages';
import { stableOrder } from '../utils/stableOrder';
import { Button, Sheet } from './ui';
import './AdminApplicants.css';
import './AdminMatching.css';

// Admin → Matching: the whole week's pairing on one desk (Polad, 2026-10-04:
// "I want to swap Aziz+Sabina for Yunus+Sabina and the admin can't; people who
// join mid-week; everyone's free time should be easy to see").
//
// Left: everyone, with how many practices they have this week against what
// they asked for, and their free time as an hourly grid (7 days × 07–23 Baku
// starts, the week the planner really sees). Since 2026-10-18 it is the
// people console: the week's verdict, health, reliability, WhatsApp, the
// Applicants answers on a tap, a «Needs attention» box whose counts filter
// the list, and «Plan selected» — the planner run for the ticked people only,
// previewed, then booked. Right: the week's pairs as they really stand — open proposals and
// booked practices, whoever made them (the Sunday plan, a refill, the admin).
//
// Every change goes through the endpoints that already exist, so nothing here
// can book what the server would refuse: a new pair is an ordinary proposal
// (adminProposeMatch — booked only when both say yes); changing a partner
// withdraws the open proposal (adminCancelOffer) or cancels the booking
// (cancelSlotMatch, which also tells both) and proposes the new pair.
// The unsent Sunday draft shows here too (dashed "draft" rows) and can be
// trimmed and sent from the desk; the list of who practises and the automatic
// switches stay on the Week tab.

const DAY_MS = 24 * 60 * 60 * 1000;
// adminWeekPlan planSelected takes at most this many people.
const PICK_MAX = 40;
const toMs = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : Number(t) || 0);
const levelShort = (lv) => LEVELS.find((l) => l.value === lv)?.short || String(lv || '').slice(0, 2) || '—';
const firstName = (n) => String(n || '').split(' ')[0] || '—';
function bakuMonday(ms) {
  const d = new Date(ms + 4 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const dayMonth = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayShort = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const blockLabel = (slotId) => `${weekdayShort(slotId.slice(0, 10))} ${slotId.slice(11)}:00`;
// Someone's own clock for a Baku block, only when it differs from Baku.
function localAt(hour, tz) {
  if (!tz || tz === 'Asia/Baku') return null;
  const diff = offsetVsBaku(tz);
  return diff ? `${formatMinutes(hour * 60 + diff)} ${cityOf(tz)}` : null;
}
const KIND = {
  pending: 'waiting for answers',
  booked: 'booked',
  held: 'held',
  draft: 'draft · not sent',
  expired: 'not answered in time',
  declined: 'declined',
  failed: 'could not be booked',
};
const isClosed = (kind) => kind === 'expired' || kind === 'declined' || kind === 'failed';

export default function AdminMatching({ users = [] }) {
  // A clock that moves once a minute, so what can still be proposed stays true.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const thisMonday = bakuMonday(now);
  const weeks = [
    { key: thisMonday, label: 'This week' },
    { key: addDays(thisMonday, 7), label: 'Next week' },
  ];
  // On Sunday (Baku) the work is next week's.
  const [week, setWeek] = useState(() => (new Date(Date.now() + 4 * 3600000).getUTCDay() === 0 ? weeks[1].key : weeks[0].key));
  const [onboarding, setOnboarding] = useState([]);
  const [roster, setRoster] = useState(undefined);
  const [rosterDoc, setRosterDoc] = useState({});
  const [autoMode, setAutoMode] = useState(false);
  const [reliability, setReliability] = useState(new Map());
  const [planning, setPlanning] = useState(false); // «Plan selected» bar for two people
  const [prevRoster, setPrevRoster] = useState(null);
  const [offers, setOffers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [plan, setPlan] = useState(null);
  const [view, setView] = useState('pairs'); // phone only: pairs | people
  const [selected, setSelected] = useState([]);
  const [change, setChange] = useState(null); // { pair, keepId }
  const [moving, setMoving] = useState(null); // a pair whose time is being changed
  const [features, setFeatures] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');

  const weekStart = Date.parse(`${week}T00:00:00+04:00`);
  useEffect(() => onSnapshot(collection(db, 'onboarding'),
    (snap) => setOnboarding(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setOnboarding([])), []);
  useEffect(() => {
    setRoster(undefined);
    return onSnapshot(doc(db, 'weekRoster', week), (snap) => {
      setRoster(snap.exists() ? (snap.get('uids') || []) : null);
      setRosterDoc(snap.exists() ? snap.data() : {});
    }, () => { setRoster(null); setRosterDoc({}); });
  }, [week]);
  // With no list saved for the week the server carries last week's forward
  // (functions rosterOf), so the desk shows that one.
  useEffect(() => onSnapshot(doc(db, 'weekRoster', addDays(week, -7)),
    (snap) => setPrevRoster(snap.exists() ? (snap.get('uids') || []) : null), () => setPrevRoster(null)), [week]);
  const effectiveRoster = roster === null ? prevRoster : roster;
  useEffect(() => onSnapshot(
    query(collection(db, 'matchOffers'), where('startMs', '>=', weekStart), where('startMs', '<', weekStart + 7 * DAY_MS)),
    (snap) => setOffers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setOffers([]),
  ), [weekStart]);
  useEffect(() => onSnapshot(
    query(collection(db, 'bookings'), where('weekKey', '==', week)),
    (snap) => setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setBookings([]),
  ), [week]);
  useEffect(() => subscribeToWeekPlan(week, setPlan), [week]);
  useEffect(() => onSnapshot(doc(db, 'appConfig', 'features'),
    (snap) => setFeatures(snap.exists() ? snap.data() : {}), () => setFeatures({})), []);
  useEffect(() => onSnapshot(doc(db, 'appConfig', 'planner'),
    (snap) => setAutoMode(snap.exists() && snap.get('rosterMode') === 'auto'), () => setAutoMode(false)), []);
  useEffect(() => onSnapshot(collection(db, 'reliability'),
    (snap) => setReliability(new Map(snap.docs.map((d) => [d.id, d.get('level') || null]))), () => setReliability(new Map())), []);
  const health = useAccountHealth();
  const packages = usePackageSummaries();
  useEffect(() => { setSelected([]); setMsg(null); setPlanning(false); }, [week]);

  // What a practice can be proposed or moved to: any whole hour (2026-10-07).
  const starts = useMemo(() => weekStarts(week, now), [week, now]);
  const pairs = useMemo(() => weekPairs(offers, bookings), [offers, bookings]);
  // Weekly-plan offers close after 24 h without an answer (respondBy); they
  // stay on the desk, faded, with "Send again" while the time is still ahead.
  const closed = useMemo(() => closedOffers(offers, pairs), [offers, pairs]);
  // The Sunday draft before it is sent: the same day cards, dashed.
  const drafts = useMemo(() => (plan && plan.status === 'draft' ? (plan.pairs || []) : [])
    .filter((p) => !p.removed)
    .map((p) => ({
      key: `d:${p.id}`, kind: 'draft', pairId: p.id, slotId: p.slotId, startMs: p.startMs, a: p.a, b: p.b,
      nameA: p.nameA || '', nameB: p.nameB || '', levelA: p.levelA || null, levelB: p.levelB || null, accepted: {},
    })), [plan]);
  const inList = useMemo(() => new Set(effectiveRoster || []), [effectiveRoster]);

  // Autopilot: the server's verdict for the week (weekRoster autoIn/autoWhy);
  // manual: the admin's list.
  const autoIn = useMemo(() => new Set(rosterDoc.autoIn || []), [rosterDoc]);
  const autoWhy = useMemo(() => rosterDoc.autoWhy || {}, [rosterDoc]);
  const people = useMemo(() => {
    const byUid = new Map(users.map((u) => [u.uid || u.id, u]));
    return onboarding
      .map((o) => {
        const u = byUid.get(o.id) || {};
        const joined = Math.max(toMs(o.submittedAt), toMs(u.createdAt));
        const availability = Array.isArray(o.availability) ? o.availability : [];
        const pkg = packages[o.id];
        const p = {
          ...o,
          id: o.id,
          ob: o,
          name: u.name || u.email || o.id.slice(0, 6),
          email: u.email || '',
          level: u.level || o.level,
          timeZone: o.timeZone,
          wants: Number(o.weeklyTarget) || 0,
          availability,
          baku: toBakuIntervals(availability, o.timeZone),
          inList: inList.has(o.id),
          isNew: joined > now - 7 * DAY_MS,
          joinedMs: joined,
          calls: Number(u.callCount) || 0,
          role: u.role,
          inWeek: autoMode ? autoIn.has(o.id) : inList.has(o.id),
          why: autoMode ? (autoWhy[o.id] || null) : null,
          health: health.get(o.id) || null,
          reliability: reliability.get(o.id) || null,
          paid: isUnlimited({ ...u, uid: o.id }, now) || (pkg?.kind === 'package' && pkg.periodEndMs > now),
        };
        return p;
      })
      .filter((p) => p.id !== ADMIN_UID && p.role !== 'teacher');
  }, [onboarding, users, inList, now, autoMode, autoIn, autoWhy, health, reliability, packages]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const say = (ok, text) => setMsg({ ok, text });

  const addToList = async (p) => {
    setBusy(`list:${p.id}`);
    try {
      // No list of its own yet: start it from the carried one, never from one name.
      const uids = roster === null ? [...new Set([...(prevRoster || []), p.id])] : arrayUnion(p.id);
      await setDoc(doc(db, 'weekRoster', week), { uids, updatedAt: serverTimestamp(), updatedBy: ADMIN_UID }, { merge: true });
    } catch (e) {
      say(false, `Could not add ${firstName(p.name)} to the list.`);
    }
    setBusy('');
  };

  // Close one pair: withdraw its proposal, or cancel the booking (both are told).
  const closePair = async (pair) => {
    if (pair.kind === 'pending') return cancelOffer(pair.offerId);
    return cancelSlotMatch(pair.slotId, pair.a);
  };
  const removePair = async (pair) => {
    const what = pair.kind === 'pending'
      ? `Withdraw the proposal ${firstName(pair.nameA)} + ${firstName(pair.nameB)}, ${blockLabel(pair.slotId)}?`
      : `Cancel the booked practice ${firstName(pair.nameA)} + ${firstName(pair.nameB)}, ${blockLabel(pair.slotId)}? Both will be told.`;
    if (!window.confirm(what)) return;
    setBusy(pair.key);
    const res = await closePair(pair);
    setBusy('');
    if (!res.ok) say(false, res.errorText); else say(true, 'Done.');
  };
  const propose = async (aId, bId, slotId, note = '') => {
    const res = await proposeMatch({ userA: aId, userB: bId, slotId, note });
    if (res.ok) return { ok: true };
    const who = { 'user-a-busy': aId, 'user-b-busy': bId, 'user-a-has-offer': aId, 'user-b-has-offer': bId }[res.error];
    const name = who ? firstName(personById.get(who)?.name) : '';
    if (res.error?.endsWith('-busy')) return { ok: false, text: `${name} already has a practice within two hours of this time.` };
    if (res.error?.endsWith('-has-offer')) return { ok: false, text: `${name} already has an open proposal within two hours of this time.` };
    return { ok: false, text: res.errorText };
  };
  // A proposal nobody answered in time: the same pair, the same block, again.
  const resend = async (pair) => {
    setBusy(pair.key);
    const res = await propose(pair.a, pair.b, pair.slotId);
    setBusy('');
    if (res.ok) say(true, `Sent again: ${firstName(pair.nameA)} + ${firstName(pair.nameB)}, ${blockLabel(pair.slotId)}.`);
    else say(false, res.text);
  };
  // Swap one side of a pair: close the old pair, then propose the new one.
  const swap = async (pair, keepId, newId) => {
    setBusy(pair.key);
    const closed = await closePair(pair);
    if (!closed.ok) { setBusy(''); say(false, closed.errorText); return; }
    const res = await propose(keepId, newId, pair.slotId);
    setBusy('');
    setChange(null);
    const keep = firstName(personById.get(keepId)?.name || (keepId === pair.a ? pair.nameA : pair.nameB));
    const fresh = firstName(personById.get(newId)?.name);
    if (res.ok) say(true, `Sent: ${keep} + ${fresh}, ${blockLabel(pair.slotId)}. It is booked when both say yes.`);
    else say(false, `The old pair was closed, but the new proposal failed: ${res.text}`);
  };

  // Same pair, another time: close the old one, propose the new block.
  const moveTo = async (pair, slotId) => {
    setBusy(pair.key);
    const closedRes = await closePair(pair);
    if (!closedRes.ok) { setBusy(''); say(false, closedRes.errorText); return; }
    const res = await propose(pair.a, pair.b, slotId);
    setBusy('');
    setMoving(null);
    if (res.ok) say(true, `Moved: ${firstName(pair.nameA)} + ${firstName(pair.nameB)} → ${blockLabel(slotId)}. Booked when both say yes.`);
    else say(false, `The old time was closed, but the new proposal failed: ${res.text}`);
  };
  const removeDraft = async (pair) => {
    setBusy(pair.key);
    const res = await weekPlanAction('remove', week, { pairId: pair.pairId });
    setBusy('');
    if (!res.ok) say(false, res.errorText);
  };
  const sendDraft = async () => {
    if (!window.confirm(`Send ${drafts.length} proposals for the week of ${dayMonth(week)}–${dayMonth(addDays(week, 6))}? Each person gets one notification.`)) return;
    setBusy('send-draft');
    const res = await weekPlanAction('send', week);
    setBusy('');
    if (!res.ok) say(false, res.errorText);
    else say(true, res.data?.alreadySent ? 'Already sent.' : `Sent ${res.data?.offers ?? drafts.length} proposals to ${res.data?.people ?? '—'} people.`);
  };
  // Every unanswered proposal that can still be sent (nine days ahead at most).
  const resendable = closed.filter((p) => p.startMs > now + 30 * 60 * 1000 && p.startMs - PROPOSE_HORIZON_DAYS * DAY_MS <= now);
  const resendAll = async () => {
    if (!window.confirm(`Send ${resendable.length} proposals again?`)) return;
    setBusy('resend-all');
    let ok = 0;
    const failed = [];
    for (const p of resendable) {
      const res = await propose(p.a, p.b, p.slotId);
      if (res.ok) ok += 1; else failed.push(`${firstName(p.nameA)} + ${firstName(p.nameB)}: ${res.text}`);
    }
    setBusy('');
    say(!failed.length, `Sent again: ${ok}.${failed.length ? ` Not sent — ${failed.join('; ')}` : ''}`);
  };
  const onlineOn = features.onlineNow !== false;
  const toggleOnline = async () => {
    try {
      await setDoc(doc(db, 'appConfig', 'features'), { onlineNow: !onlineOn }, { merge: true });
    } catch {
      say(false, 'Could not save the Online now switch.');
    }
  };

  // Two ticked = a proposal for one time; more = «Plan selected» (planner).
  const toggleSelect = (id) => setSelected((cur) => (cur.includes(id)
    ? cur.filter((x) => x !== id)
    : [...cur, id].slice(-PICK_MAX)));

  const byDay = useMemo(() => {
    const m = new Map();
    for (let i = 0; i < 7; i += 1) m.set(addDays(week, i), []);
    for (const p of [...pairs, ...closed, ...drafts]) m.get(p.slotId.slice(0, 10))?.push(p);
    for (const list of m.values()) list.sort((x, y) => x.startMs - y.startMs);
    return [...m.entries()];
  }, [pairs, closed, drafts, week]);

  const listCount = people.filter((p) => p.inList).length;
  const shortCount = people.filter((p) => p.inList && p.wants > plannedCount(pairs, p.id)).length;

  return (
    <div className="mt">
      <div className="mt-top">
        <div className="aa-filters" role="tablist" aria-label="Week">
          {weeks.map((w) => (
            <button key={w.key} type="button" role="tab" aria-selected={week === w.key}
              className={`aa-chip ${week === w.key ? 'is-on' : ''}`} onClick={() => setWeek(w.key)}>
              {w.label} · {dayMonth(w.key)}–{dayMonth(addDays(w.key, 6))}
            </button>
          ))}
        </div>
        <p className="aa-meta">
          {pairs.length} pairs · {pairs.filter((p) => p.kind !== 'pending').length} booked
          · {pairs.filter((p) => p.kind === 'pending').length} waiting · {listCount} in the list
          · {shortCount} short of their target
        </p>
        <div className="mt-actions">
          {drafts.length > 0 && (
            <Button size="sm" icon={<Send size={16} aria-hidden="true" />} disabled={!!busy} onClick={sendDraft}>
              {busy === 'send-draft' ? 'Sending…' : `Send draft (${drafts.length}) for ${dayMonth(week)}–${dayMonth(addDays(week, 6))}`}
            </Button>
          )}
          {resendable.length > 1 && (
            <Button size="sm" variant="secondary" icon={<RotateCcw size={16} aria-hidden="true" />} disabled={!!busy} onClick={resendAll}>
              {busy === 'resend-all' ? 'Sending…' : `Send all again (${resendable.length})`}
            </Button>
          )}
          {/* Temporary (Polad 2026-10-06): who is in the app right now, on
              Today and Partners, with a call button. functions onlineNow. */}
          <label className="aa-meta mt-online">
            <input type="checkbox" className="aa-check" checked={onlineOn} onChange={toggleOnline} />
            Online now list for learners
          </label>
        </div>
        {roster === null && <p className="mt-note">No list saved for this week — the most recent list of the last four weeks is used automatically. Add people from the left to make this week's own.</p>}
        {msg && <p className={msg.ok ? 'aa-ok' : 'aa-error'} role="status">{msg.text}</p>}
        <div className="mt-switch" role="tablist" aria-label="Show">
          {[['pairs', 'Pairs'], ['people', 'People']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id}
              className={`aa-chip ${view === id ? 'is-on' : ''}`} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className={`mt-grid is-${view}`}>
        <PeoplePanel
          week={week} people={people} pairs={pairs} selected={selected} autoMode={autoMode} now={now}
          onToggle={toggleSelect} onAdd={addToList} busy={busy}
        />
        <section className="mt-pairs" aria-label="Pairs">
          {pairs.length + closed.length === 0 && <p className="aa-panel aa-empty">No pairs this week yet. Tick two people to propose one.</p>}
          {byDay.filter(([, list]) => list.length > 0).map(([date, list]) => (
            <div key={date} className="aa-panel mt-day">
              <h3 className="aa-h">{weekdayShort(date)} {dayMonth(date)}</h3>
              {(
                <ul className="mt-pair-list">
                  {list.map((p) => (
                    <PairRow key={p.key} pair={p} personById={personById} busy={busy === p.key}
                      canEdit={p.kind !== 'held' && p.kind !== 'draft' && !isClosed(p.kind) && p.startMs > now}
                      onMove={() => setMoving(p)}
                      onRemoveDraft={p.kind === 'draft' ? () => removeDraft(p) : null}
                      onResend={isClosed(p.kind) && p.startMs > now + 30 * 60 * 1000 ? () => resend(p) : null}
                      resendFrom={p.startMs - PROPOSE_HORIZON_DAYS * DAY_MS}
                      onChange={(keepId) => setChange({ pair: p, keepId })}
                      onRemove={() => removePair(p)} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      </div>

      {(selected.length > 2 || (selected.length === 2 && planning)) && (
        <PlanBar
          week={week} chosen={selected.map((id) => personById.get(id)).filter(Boolean)}
          onClear={() => { setSelected([]); setPlanning(false); }}
          onBack={selected.length === 2 ? () => setPlanning(false) : null}
          onBooked={(text) => { say(true, text); setSelected([]); setPlanning(false); }}
        />
      )}
      {selected.length > 0 && selected.length <= 2 && !planning && (
        <NewPairBar
          onPlan={() => setPlanning(true)}
          chosen={selected.map((id) => personById.get(id)).filter(Boolean)}
          blocks={starts} pairs={pairs}
          onClear={() => setSelected([])}
          onSend={async (slotId, note) => {
            const [a, b] = selected;
            const res = await propose(a, b, slotId, note);
            if (res.ok) {
              say(true, `Sent to ${firstName(personById.get(a)?.name)} and ${firstName(personById.get(b)?.name)}. It is booked when both say yes.`);
              setSelected([]);
            }
            return res;
          }}
        />
      )}

      <TimeSheet
        pair={moving} people={people} pairs={pairs} blocks={starts} busy={!!busy}
        onClose={() => setMoving(null)} onPick={(slotId) => moveTo(moving, slotId)}
      />

      <ChangeSheet
        change={change} people={people} pairs={pairs} busy={!!busy}
        onClose={() => setChange(null)}
        onPick={(newId) => swap(change.pair, change.keepId, newId)}
      />
    </div>
  );
}

// ── People ───────────────────────────────────────────────────────
// Verdict words for the week (functions/autoRoster.js eligible + health).
const WHY = {
  said_in: 'said «in»', package: 'package', new: 'new this week', included: 'always (you)', regular: 'said yes lately',
  usual_times: 'usual times', excluded: 'never (you)', asleep: 'not seen 7+ days', not_confirmed: 'did not say «in»',
  skipped: 'week off', snoozed: '2 proposals ignored', no_practices_left: 'no practices left', not_set_up: 'not set up',
  paused: 'paused', sleeping: 'sleeping', ghost: 'ghost', suspicious: 'flagged',
};
const HEALTH = { sleeping: 'sleeping', ghost: 'ghost', suspicious: 'flagged' };

function PeoplePanel({ week, people, pairs, selected, onToggle, onAdd, busy, autoMode, now }) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All');
  const [only, setOnly] = useState('list'); // list | short | all
  const [flag, setFlag] = useState(null); // a «Needs attention» key
  const [open, setOpen] = useState(null);
  const rankRef = useRef({ key: '', rank: new Map() });

  const all = people.map((p) => {
    const planned = plannedCount(pairs, p.id);
    return { ...p, planned, attention: attentionOf({ ...p, planned, health: p.health?.cls }, now) };
  });
  const counts = Object.fromEntries(ATTENTION.map(([k]) => [k, all.filter((p) => p.attention[k]).length]));
  const shown = all
    .filter((p) => level === 'All' || levelShort(p.level) === level)
    // A «Needs attention» count shows everyone with that flag, in the week or not.
    .filter((p) => (flag ? p.attention[flag]
      : only === 'all' || (only === 'list' ? p.inWeek : p.inWeek && p.planned < p.wants)) || selected.includes(p.id))
    .filter((p) => !search.trim() || `${p.name} ${p.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  // New people first, then whoever is furthest below their target; each row
  // then keeps its place until a filter changes (stableOrder).
  const key = `${week}|${level}|${only}|${flag}|${search}`;
  if (rankRef.current.key !== key) rankRef.current = { key, rank: new Map() };
  const ordered = stableOrder(shown,
    (a, b) => (b.isNew - a.isNew) || ((b.wants - b.planned) - (a.wants - a.planned)) || a.name.localeCompare(b.name),
    rankRef.current.rank);

  return (
    <section className="aa-panel mt-people" aria-label="People">
      <h3 className="aa-h">People</h3>
      {ATTENTION.some(([k]) => counts[k] > 0) && (
        <div className="mt-attn" role="group" aria-label="Needs attention">
          <span className="aa-sub">Needs attention</span>
          <div className="mt-attn-list">
            {ATTENTION.filter(([k]) => counts[k] > 0).map(([k, label]) => (
              <button key={k} type="button" className={`mt-attn-item ${flag === k ? 'is-on' : ''}`} aria-pressed={flag === k}
                onClick={() => setFlag((f) => (f === k ? null : k))}>
                <b>{counts[k]}</b> {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="aa-meta">
        Tick two to propose one time, or more to let the planner pair them. Each grid is the week in Baku
        hours 07–23, Monday at the top: dark = picked for this week, light = usual time, outline = maybe, solid = a practice.
      </p>
      <div className="aa-filters">
        <label className="aa-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      <div className="aa-filters">
        {[['list', autoMode ? 'In this week' : 'In the list'], ['short', 'Need more'], ['all', 'Everyone']].map(([id, label]) => (
          <button key={id} type="button" className={`aa-chip ${!flag && only === id ? 'is-on' : ''}`}
            onClick={() => { setOnly(id); setFlag(null); }}>{label}</button>
        ))}
        {['All', ...LEVELS.slice(0, 5).map((l) => l.short)].map((l) => (
          <button key={l} type="button" className={`aa-chip ${level === l ? 'is-on' : ''}`} onClick={() => setLevel(l)}>{l}</button>
        ))}
      </div>
      <ul className="mt-people-list">
        {ordered.map((p) => (
          <PersonRow key={p.id} p={p} week={week} pairs={pairs} autoMode={autoMode}
            on={selected.includes(p.id)} expanded={open === p.id}
            onToggle={() => onToggle(p.id)} onExpand={() => setOpen((x) => (x === p.id ? null : p.id))}
            onAdd={() => onAdd(p)} adding={busy === `list:${p.id}`} />
        ))}
        {ordered.length === 0 && <li className="aa-empty">Nobody matches.</li>}
      </ul>
    </section>
  );
}

function PersonRow({ p, week, pairs, autoMode, on, expanded, onToggle, onExpand, onAdd, adding }) {
  const wa = whatsAppLink(p.whatsapp, p.name);
  const verdict = autoMode
    ? (p.why ? `${p.inWeek ? 'in' : 'out'} · ${WHY[p.why] || p.why}` : 'not checked yet')
    : (p.inList ? 'in the list' : 'not in the list');
  const healthWord = HEALTH[p.health?.cls];
  const rel = p.reliability && p.reliability !== 'ok' ? p.reliability : null;
  return (
    <li className={`mt-person ${on ? 'is-on' : ''} ${expanded ? 'is-open' : ''}`}>
      <label className="mt-person-main">
        <input type="checkbox" className="aa-check" checked={on} onChange={onToggle} aria-label={`Select ${p.name}`} />
        <span className="mt-person-text">
          <span className="aa-name">
            {p.name} <span className="aa-level">{levelShort(p.level)}</span>
            {p.isNew && <span className="aa-badge aa-badge--soft">new</span>}
          </span>
          <span className={`aa-meta ${p.planned < p.wants ? 'mt-short' : ''}`}>
            {p.planned} of {p.wants || '—'} this week · {verdict}
            {p.timeZone && p.timeZone !== 'Asia/Baku' ? ` · ${cityOf(p.timeZone)}` : ''}
          </span>
          {(p.paid || healthWord || rel) && (
            <span className="mt-tags">
              {p.paid && <span className="aa-badge aa-badge--soft">paid</span>}
              {healthWord && <span className="aa-badge">{healthWord}</span>}
              {rel && <span className="aa-badge">reliability {rel}</span>}
            </span>
          )}
        </span>
      </label>
      <span className="mt-person-tools">
        {wa && (
          <a className="aa-icon-btn" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${p.name}`}>
            <MessageCircle size={16} aria-hidden="true" />
          </a>
        )}
        <button type="button" className="aa-icon-btn" aria-expanded={expanded}
          aria-label={expanded ? `Hide ${p.name}'s answers` : `Show ${p.name}'s answers`} onClick={onExpand}>
          <ChevronDown size={16} className="aa-chev" aria-hidden="true" />
        </button>
      </span>
      <FreeGrid person={p} week={week} pairs={pairs} />
      {!autoMode && !p.inList && (
        <button type="button" className="aa-linkbtn mt-add" disabled={adding} onClick={onAdd}>
          <UserPlus size={14} aria-hidden="true" /> Add to this week's list
        </button>
      )}
      {expanded && <div className="mt-person-detail"><ApplicantDetail p={p} /></div>}
    </li>
  );
}

// 7 days × hourly Baku starts 07–23 (utils/matching freeGrid).
function FreeGrid({ person, week, pairs }) {
  const g = useMemo(() => freeGrid({ onboarding: person.ob, monday: week, uid: person.id, pairs }), [person.ob, week, person.id, pairs]);
  const label = g.skip ? 'Week off'
    : `${g.free} free hours this week${g.picked ? ' (picked for this week)' : ''}, ${g.practices} with a partner`;
  return (
    <div className="mt-free" role="img" aria-label={label} title={label}>
      {g.rows.flatMap((row) => row.cells.map((c) => {
        const note = c.state === 'pair' ? ` · ${KIND[c.kind] || 'practice'}`
          : c.state === 'off' ? ' · usual time, not this week' : c.maybe ? ' · maybe' : '';
        return (
          <span key={c.slotId} className={`mt-cell ${c.state ? `is-${c.state}` : ''} ${c.maybe ? 'is-maybe' : ''}`}
            title={`${blockLabel(c.slotId)}${note}`} />
        );
      }))}
    </div>
  );
}

// More than two ticked (or «Let the planner choose» for two): the planner for
// these people only, over what is left of the week (adminWeekPlan
// planSelected — writes nothing), then «Book these» (bookSelected): each pair
// through the same checks as any booking; only counts come back.
function PlanBar({ week, chosen, onClear, onBack, onBooked }) {
  const [state, setState] = useState('idle'); // idle | planning | booking
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const ids = chosen.map((p) => p.id);
  const idKey = ids.join('|');
  useEffect(() => { setPlan(null); setError(''); setState('idle'); }, [idKey, week]);
  const nameOf = (uid, fallback) => firstName(chosen.find((p) => p.id === uid)?.name || fallback);

  const run = async () => {
    setState('planning'); setError('');
    const res = await weekPlanAction('planSelected', week, { uids: ids });
    setState('idle');
    if (!res.ok) { setError(res.errorText || 'Could not plan.'); return; }
    setPlan(res.data);
  };
  const book = async () => {
    const pairs = plan.pairs.map(({ a, b, slotId }) => ({ a, b, slotId }));
    if (!window.confirm(`Book ${pairs.length} practices now? Each person gets a notification; no one has to confirm.`)) return;
    setState('booking'); setError('');
    const res = await weekPlanAction('bookSelected', week, { uids: ids, pairs });
    setState('idle');
    if (!res.ok) { setError(res.errorText || 'Could not book.'); return; }
    const { booked = 0, refused = 0 } = res.data || {};
    onBooked(`Booked ${booked} of ${pairs.length}${refused ? ` · ${refused} could not be booked (someone is busy then or the pair is not allowed)` : ''}.`);
  };
  const left = plan ? [...new Set([...(plan.unmet || []).map((u) => u.uid), ...(plan.skipped || [])])] : [];

  return (
    <div className="aa-sticky-bar mt-bar mt-bar--open">
      <div className="mt-bar-head">
        <b><Sparkles size={16} aria-hidden="true" /> Plan {chosen.length}: {chosen.map((p) => firstName(p.name)).join(', ')}</b>
        <span className="mt-actions">
          {onBack && <Button size="sm" variant="ghost" onClick={onBack}>One time</Button>}
          <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
        </span>
      </div>
      {!plan && (
        <p className="aa-meta">The planner pairs only these people over the rest of the week — their times, numbers and the pairing rules. Nothing is sent until you book.</p>
      )}
      {plan && plan.pairs.length === 0 && <p className="aa-empty">The planner found no pair for these people this week.</p>}
      {plan && plan.pairs.length > 0 && (
        <ul className="mt-plan-list">
          {plan.pairs.map((p) => (
            <li key={`${p.slotId}|${p.a}|${p.b}`} className="mt-plan-row">
              <b>{blockLabel(p.slotId)}</b>
              <span>{nameOf(p.a, p.nameA)} + {nameOf(p.b, p.nameB)}</span>
            </li>
          ))}
        </ul>
      )}
      {plan && left.length > 0 && (
        <p className="aa-meta">Nothing more for: {left.map((u) => nameOf(u, u.slice(0, 6))).join(', ')}.</p>
      )}
      <div className="mt-actions">
        <Button size="sm" variant={plan ? 'secondary' : 'primary'} icon={<Sparkles size={16} aria-hidden="true" />}
          disabled={state !== 'idle'} onClick={run}>
          {state === 'planning' ? 'Planning…' : plan ? 'Plan again' : `Plan these ${chosen.length}`}
        </Button>
        {plan && plan.pairs.length > 0 && (
          <Button size="sm" icon={<CalendarCheck size={16} aria-hidden="true" />} disabled={state !== 'idle'} onClick={book}>
            {state === 'booking' ? 'Booking…' : `Book these (${plan.pairs.length})`}
          </Button>
        )}
      </div>
      {error && <p className="aa-error" role="status">{error}</p>}
    </div>
  );
}

// ── Pairs ────────────────────────────────────────────────────────
function PairRow({ pair, personById, busy, canEdit, onChange, onRemove, onResend, resendFrom, onMove, onRemoveDraft }) {
  const hour = Number(pair.slotId.slice(11));
  const side = (uid, name, level) => {
    const p = personById.get(uid);
    const local = localAt(hour, p?.timeZone);
    return (
      <span className="mt-side">
        <span className="aa-name">
          {pair.accepted[uid] && pair.kind === 'pending' && <Check size={14} aria-label="said yes" />}
          {firstName(p?.name || name)} <span className="aa-level">{levelShort(p?.level || level)}</span>
        </span>
        {local && <span className="aa-meta">{local}</span>}
        {/* Who still has to answer — the admin can nudge them on WhatsApp. */}
        {pair.kind === 'pending' && !pair.accepted[uid] && <span className="aa-meta">not answered yet</span>}
        {canEdit && (
          <button type="button" className="aa-linkbtn" disabled={busy} onClick={() => onChange(uid === pair.a ? pair.b : pair.a)}
            aria-label={`Change ${firstName(p?.name || name)}`}>
            <ArrowLeftRight size={14} aria-hidden="true" /> Change
          </button>
        )}
      </span>
    );
  };
  const gap = levelGap(personById.get(pair.a)?.level || pair.levelA, personById.get(pair.b)?.level || pair.levelB);
  return (
    <li className={`mt-pair is-${pair.kind}`}>
      <div className="mt-pair-head">
        <b>{pair.slotId.slice(11)}:00 Baku</b>
        <span className="aa-badge aa-badge--soft">{KIND[pair.kind]}</span>
        {pair.source === 'weekly_plan' && <span className="aa-meta">plan</span>}
        {pair.source === 'refill' && <span className="aa-meta">refill</span>}
        {gap !== null && gap > 1 && <span className="aa-badge">levels {gap} apart</span>}
      </div>
      <div className="mt-pair-sides">
        {side(pair.a, pair.nameA, pair.levelA)}
        <span className="mt-plus" aria-hidden="true">+</span>
        {side(pair.b, pair.nameB, pair.levelB)}
      </div>
      {/* adminProposeMatch refuses blocks more than nine days ahead. */}
      {onResend && resendFrom > Date.now() && (
        <span className="aa-meta">Can be sent again from {new Date(resendFrom).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      )}
      {onResend && resendFrom <= Date.now() && (
        <button type="button" className="aa-linkbtn mt-remove" disabled={busy} onClick={onResend}>
          <Send size={14} aria-hidden="true" /> {busy ? 'Sending…' : 'Send again'}
        </button>
      )}
      {(canEdit || onRemoveDraft) && (
        <div className="mt-pair-actions">
          {canEdit && (
            <button type="button" className="aa-linkbtn" disabled={busy} onClick={onMove}>
              <Clock size={14} aria-hidden="true" /> Change time
            </button>
          )}
          {canEdit && (
            <button type="button" className="aa-linkbtn" disabled={busy} onClick={onRemove}>
              <X size={14} aria-hidden="true" /> {busy ? 'Working…' : pair.kind === 'pending' ? 'Withdraw' : 'Cancel booking'}
            </button>
          )}
          {onRemoveDraft && (
            <button type="button" className="aa-linkbtn" disabled={busy} onClick={onRemoveDraft}>
              <Trash2 size={14} aria-hidden="true" /> {busy ? 'Working…' : 'Remove from draft'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// "Change time": the week's blocks that still fit both of them.
function TimeSheet({ pair, people, pairs, blocks, busy, onClose, onPick }) {
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [pair]);
  if (!pair) return <Sheet open={false} onClose={onClose} />;
  const a = people.find((p) => p.id === pair.a);
  const b = people.find((p) => p.id === pair.b);
  const common = overlapAll([a?.baku || [], b?.baku || []]);
  // Busy = either of them in ANOTHER practice whose window overlaps.
  const others = pairs.filter((x) => x.key !== pair.key);
  const busyAt = (blk) => { const s = busyAround(others, blk.startMs); return s.has(pair.a) || s.has(pair.b); };
  const options = blocks
    .filter((blk) => blk.bookable && blk.slotId !== pair.slotId && !busyAt(blk))
    .map((blk) => ({ ...blk, fit: startFitMin(common, blk) }))
    .filter((blk) => all || blk.fit >= START_FIT_MIN);
  const names = `${firstName(pair.nameA)} + ${firstName(pair.nameB)}`;
  return (
    <Sheet open onClose={onClose} title={`New time for ${names}`}>
      <p className="aa-meta">
        Now {blockLabel(pair.slotId)} Baku. The old time is {pair.kind === 'pending' ? 'withdrawn' : 'cancelled and both are told'};
        the new one is an ordinary proposal — booked when both say yes.
      </p>
      {options.length === 0
        ? <p className="aa-empty">{all ? 'No bookable time left this week.' : 'No other time this week fits both.'}</p>
        : (
          <div className="aa-blocks mt-blocks">
            {options.map((blk) => (
              <button key={blk.slotId} type="button" className={`aa-block ${blk.fit >= START_FIT_MIN ? '' : 'is-weak'}`} disabled={busy}
                onClick={() => { if (window.confirm(`${names} → ${blockLabel(blk.slotId)} Baku?`)) onPick(blk.slotId); }}>
                <b>{blockLabel(blk.slotId)}</b>
                <span>{blk.fit >= START_FIT_MIN ? `both free ${blk.fit} min` : 'outside common time'}</span>
                <span>{[a, b].map((p) => p && localAt(blk.hour, p.timeZone) && `${firstName(p.name)} ${localAt(blk.hour, p.timeZone)}`).filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
        )}
      <button type="button" className="aa-linkbtn" onClick={() => setAll((v) => !v)}>
        <CalendarClock size={14} aria-hidden="true" /> {all ? 'Only times that fit both' : 'Show all times'}
      </button>
    </Sheet>
  );
}

// "Change partner": who can take this practice instead.
function ChangeSheet({ change, people, pairs, busy, onClose, onPick }) {
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [change]);
  if (!change) return <Sheet open={false} onClose={onClose} />;
  const { pair, keepId } = change;
  const hour = Number(pair.slotId.slice(11));
  const block = { slotId: pair.slotId, hour, startMs: pair.startMs, day: new Date(`${pair.slotId.slice(0, 10)}T12:00:00Z`).getUTCDay() };
  const keep = people.find((p) => p.id === keepId);
  const keepName = firstName(keep?.name || (keepId === pair.a ? pair.nameA : pair.nameB));
  const outName = firstName(keepId === pair.a ? pair.nameB : pair.nameA);
  const list = candidatesFor({ keepId, block, people, pairs, all });
  return (
    <Sheet open onClose={onClose} title={`New partner for ${keepName} · ${blockLabel(pair.slotId)} Baku`}>
      <p className="aa-meta">
        {outName} leaves this practice: {pair.kind === 'pending' ? 'the proposal is withdrawn' : 'the booking is cancelled and both are told'}.
        The new pair gets an ordinary proposal — booked when both say yes.
      </p>
      <ul className="mt-cand-list">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" className="mt-cand" disabled={busy} onClick={() => {
              if (window.confirm(`${keepName} + ${firstName(p.name)}, ${blockLabel(pair.slotId)} Baku?`)) onPick(p.id);
            }}>
              <span className="aa-name">
                {p.name} <span className="aa-level">{levelShort(p.level)}</span>
                {!p.inList && <span className="aa-badge">not in the list</span>}
              </span>
              <span className="aa-meta">
                {p.fit >= START_FIT_MIN ? `free ${p.fit} min from then` : 'not free then'}
                {' · '}{p.planned} of {p.wants || '—'} this week
                {localAt(hour, p.timeZone) ? ` · ${localAt(hour, p.timeZone)}` : ''}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="aa-empty">Nobody else is free in this block.</li>}
      </ul>
      <button type="button" className="aa-linkbtn" onClick={() => setAll((v) => !v)}>
        {all ? 'Only people free then' : 'Show people who are not free then'}
      </button>
    </Sheet>
  );
}

// Two people ticked: the week's blocks that fit both, then send.
function NewPairBar({ chosen, blocks, pairs, onClear, onSend, onPlan }) {
  const [slotId, setSlotId] = useState('');
  const [note, setNote] = useState('');
  const [all, setAll] = useState(false);
  const [state, setState] = useState(null);
  // Closed until asked for: an open time list covers the People column, and
  // the admin may still be ticking a third person for the planner.
  const [open, setOpen] = useState(false);
  const ids = chosen.map((p) => p.id).join('|');
  useEffect(() => { setSlotId(''); setState(null); setAll(false); }, [ids]);

  if (chosen.length < 2) {
    return (
      <div className="aa-sticky-bar mt-bar">
        <span className="aa-sticky-count">{firstName(chosen[0]?.name)} — tick one more for a time, or several for the planner</span>
        <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
      </div>
    );
  }
  const [a, b] = chosen;
  if (!open) {
    return (
      <div className="aa-sticky-bar mt-bar">
        <span className="aa-sticky-count">{firstName(a.name)} + {firstName(b.name)}</span>
        <span className="mt-actions">
          <Button size="sm" icon={<CalendarClock size={16} aria-hidden="true" />} onClick={() => setOpen(true)}>Pick a time</Button>
          <Button size="sm" variant="secondary" icon={<Sparkles size={16} aria-hidden="true" />} onClick={onPlan}>Let the planner choose</Button>
          <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
        </span>
      </div>
    );
  }
  const common = overlapAll([a.baku, b.baku]);
  const busyBlock = (blk) => { const s = busyAround(pairs, blk.startMs); return s.has(a.id) || s.has(b.id); };
  const options = blocks
    .filter((blk) => blk.bookable && !busyBlock(blk))
    .map((blk) => ({ ...blk, fit: startFitMin(common, blk) }))
    .filter((blk) => all || blk.fit >= START_FIT_MIN);
  const send = async () => {
    setState('sending');
    const res = await onSend(slotId, note);
    setState(res.ok ? null : res.text);
  };
  return (
    <div className="aa-sticky-bar mt-bar mt-bar--open">
      <div className="mt-bar-head">
        <b><Plus size={16} aria-hidden="true" /> {firstName(a.name)} + {firstName(b.name)}</b>
        <span className="mt-actions">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Hide times</Button>
          <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
        </span>
      </div>
      {options.length === 0 ? (
        <p className="aa-empty">{all ? 'No bookable time left this week.' : 'No time this week fits both.'}</p>
      ) : (
        <div className="aa-blocks mt-blocks" role="radiogroup" aria-label="Practice time">
          {options.map((blk) => (
            <button key={blk.slotId} type="button" role="radio" aria-checked={slotId === blk.slotId}
              className={`aa-block ${slotId === blk.slotId ? 'is-on' : ''} ${blk.fit >= START_FIT_MIN ? '' : 'is-weak'}`}
              onClick={() => setSlotId(blk.slotId)}>
              <b>{blockLabel(blk.slotId)}</b>
              <span>{blk.fit >= START_FIT_MIN ? `both free ${blk.fit} min` : 'outside common time'}</span>
              <span>{[a, b].map((p) => localAt(blk.hour, p.timeZone) && `${firstName(p.name)} ${localAt(blk.hour, p.timeZone)}`).filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className="aa-linkbtn" onClick={() => setAll((v) => !v)}>
        <CalendarClock size={14} aria-hidden="true" /> {all ? 'Only times that fit both' : 'Show all times'}
      </button>
      <input className="aa-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for both (e.g. topic: Travel)" aria-label="Note" />
      <Button size="sm" icon={<Send size={16} aria-hidden="true" />} disabled={!slotId || state === 'sending'} onClick={send}>
        {state === 'sending' ? 'Sending…' : 'Send proposal to both'}
      </Button>
      {state && state !== 'sending' && <p className="aa-error" role="status">{state}</p>}
    </div>
  );
}
