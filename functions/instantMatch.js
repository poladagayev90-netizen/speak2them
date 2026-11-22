// ── Instant first-match waterfall (2026-11-22) ──
// When a newcomer finishes onboarding they must NEVER land on a dead/empty
// screen. Pure selection logic; functions/index.js runs the actual booking and
// idempotency + maxPerDay checks inside ONE Firestore transaction.
//
// Waterfall:
//   Tier 1: Learner Free hours ∩ Host open hours within 72h (≥ minLeadHours ahead)
//   Tier 2: Learner Free/Maybe hours ∩ Host open hours within 7 days
//   Tier 3: Zero overlap → top 3 nearest open Host slots across 7 days (pick mode)

const weeklyPlanner = require('./weeklyPlanner');
const { hoursToRanges } = require('./newcomers');
const { parseHours } = require('./autoRoster');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BLOCK_MS = 2 * HOUR_MS;
const TIER1_WINDOW_MS = 72 * HOUR_MS;
const HORIZON_DAYS = 7;
const DEFAULT_MAX_PER_DAY = 2;
const DEFAULT_MIN_LEAD_HOURS = 2;
const MAX_HOSTS = 20;

const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

// Parse appConfig/planner.newcomerHosts entries cleanly.
// Backward-compatible with string uids and { uid, hours } objects.
function parseHostConfigs(raw, adminUid = null) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const e of raw) {
    const uid = typeof e === 'string' ? e.trim() : (e && typeof e.uid === 'string' ? e.uid.trim() : '');
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const obj = typeof e === 'object' && e ? e : {};
    const hours = obj.hours ? parseHours(obj.hours) : null;
    const isFounder = obj.isFounder === true || (!!adminUid && uid === adminUid);
    out.push({
      uid,
      hours,
      maxPerDay: clampInt(obj.maxPerDay, 1, 6, DEFAULT_MAX_PER_DAY),
      minLeadHours: clampInt(obj.minLeadHours, 1, 12, DEFAULT_MIN_LEAD_HOURS),
      isFounder,
      label: typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : null,
    });
    if (out.length >= MAX_HOSTS) break;
  }
  return out;
}

// Honest host presentation: Polad is always "Polad · SpeakLab team", never a
// fake student profile; other hosts are "<First name> · Verified Partner".
function hostPresentation({ uid, name = '', isFounder = false, adminUid = null, label = null }) {
  const founder = isFounder || (!!adminUid && uid === adminUid);
  if (founder) {
    return {
      hostName: 'Polad',
      hostBadge: 'SpeakLab team',
      hostLabel: label || 'Polad · SpeakLab team',
      isFounder: true,
    };
  }
  const first = String(name || '').trim().split(/\s+/)[0] || 'SpeakLab Partner';
  return {
    hostName: first,
    hostBadge: 'Verified Partner',
    hostLabel: `${first} · Verified Partner`,
    isFounder: false,
  };
}

// Next `days` Baku YYYY-MM-DD dates starting from `nowMs`.
function upcomingBakuDates(nowMs, days = HORIZON_DAYS) {
  const start = new Date(nowMs + 4 * HOUR_MS);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const d = start.getUTCDate();
  const out = [];
  for (let i = 0; i < days; i += 1) {
    out.push(new Date(Date.UTC(y, m, d + i)).toISOString().slice(0, 10));
  }
  return out;
}

// Check if a host can take `slotId` given their existing confirmed bookings
// (`bookings`: [{ date, startMs }]).
function hostSlotAvailable(host, slotId, bookings = []) {
  const date = slotId.slice(0, 10);
  const hour = Number(slotId.slice(11));
  const startMs = weeklyPlanner.blockStartMs(date, hour);
  const maxPerDay = host.maxPerDay || DEFAULT_MAX_PER_DAY;
  let dayCount = 0;
  for (const b of bookings) {
    if (b.date === date) dayCount += 1;
    if (Math.abs((Number(b.startMs) || 0) - startMs) < BLOCK_MS) return false;
  }
  return dayCount < maxPerDay;
}

// All open slots a single host can take over `dates`, respecting their
// minLeadHours, maxPerDay and existing bookings.
function openHostSlots(host, dates, bookings, nowMs) {
  const availability = host.hours ? hoursToRanges(host.hours) : (Array.isArray(host.availability) ? host.availability : []);
  if (!availability.length) return [];
  const earliestMs = nowMs + (host.minLeadHours || DEFAULT_MIN_LEAD_HOURS) * HOUR_MS;
  const raw = weeklyPlanner.freeSlots({
    availability,
    busyAvailability: Array.isArray(host.busyAvailability) ? host.busyAvailability : [],
    timeZone: host.hours ? 'Asia/Baku' : (host.timeZone || 'Asia/Baku'),
  }, dates, earliestMs);
  return raw
    .filter((slotId) => hostSlotAvailable(host, slotId, bookings))
    .map((slotId) => ({
      slotId,
      date: slotId.slice(0, 10),
      startMs: weeklyPlanner.blockStartMs(slotId.slice(0, 10), Number(slotId.slice(11))),
      hostUid: host.uid,
      ...hostPresentation(host),
    }));
}

// Compute ordered booking candidates + fallback pick options for a newcomer.
//   learner: { uid, minor, availability, maybeAvailability, busyAvailability, timeZone, teacherId }
//   hosts:   [{ uid, name, hours?, availability?, busyAvailability?, timeZone?, maxPerDay, minLeadHours, isFounder, adminUid, minor? }]
//   hostBookings: Map<hostUid, [{ date, startMs }]>
// Returns:
//   {
//     tier: 1 | 2 | 3 | 0,
//     candidates: [{ slotId, startMs, hostUid, hostName, hostBadge, hostLabel, isFounder }],
//     alternatives: [...] (up to 3 distinct slots for "Pick another time" / Tier 3 pick)
//   }
function planInstantMatch({ learner, hosts = [], hostBookings = new Map(), nowMs = Date.now(), adminUid = null }) {
  if (!learner || !hosts.length) return { tier: 0, candidates: [], alternatives: [] };
  const dates = upcomingBakuDates(nowMs, HORIZON_DAYS);

  // Filter hosts eligible for this learner (note: pairVerdict enforces under18
  // authoritatively inside the booking transaction; we mirror supervised-team
  // eligibility here so we never waste a transaction on a guaranteed clash).
  const eligibleHosts = hosts.filter((h) => {
    if (!h || !h.uid || h.uid === learner.uid) return false;
    if (learner.teacherId && learner.teacherId === h.uid) return false;
    if (learner.minor) {
      const supervised = h.isFounder || (!!adminUid && h.uid === adminUid);
      if (!supervised && !h.minor) return false;
    }
    return true;
  });
  if (!eligibleHosts.length) return { tier: 0, candidates: [], alternatives: [] };

  const hostSlotPool = [];
  for (const h of eligibleHosts) {
    const bks = hostBookings.get(h.uid) || [];
    for (const s of openHostSlots({ ...h, adminUid }, dates, bks, nowMs)) {
      hostSlotPool.push(s);
    }
  }
  hostSlotPool.sort((a, b) => a.startMs - b.startMs || (b.isFounder - a.isFounder) || a.hostUid.localeCompare(b.hostUid));
  if (!hostSlotPool.length) return { tier: 0, candidates: [], alternatives: [] };

  const minLead = Math.min(...eligibleHosts.map((h) => h.minLeadHours || DEFAULT_MIN_LEAD_HOURS));
  const learnerEarliest = nowMs + minLead * HOUR_MS;
  const learnerFree = new Set(weeklyPlanner.freeSlots({
    availability: Array.isArray(learner.availability) ? learner.availability : [],
    busyAvailability: Array.isArray(learner.busyAvailability) ? learner.busyAvailability : [],
    timeZone: learner.timeZone || 'Asia/Baku',
  }, dates, learnerEarliest));

  const learnerMaybe = new Set(weeklyPlanner.freeSlots({
    availability: Array.isArray(learner.maybeAvailability) ? learner.maybeAvailability : [],
    busyAvailability: Array.isArray(learner.busyAvailability) ? learner.busyAvailability : [],
    timeZone: learner.timeZone || 'Asia/Baku',
  }, dates, learnerEarliest));

  const tier1Cutoff = nowMs + TIER1_WINDOW_MS;
  const tier1 = hostSlotPool.filter((s) => learnerFree.has(s.slotId) && s.startMs <= tier1Cutoff);
  const tier2 = hostSlotPool.filter((s) => !tier1.includes(s) && (learnerFree.has(s.slotId) || learnerMaybe.has(s.slotId)));

  // Pick up to 3 varied fallback/alternative options (spread across days when possible).
  const pickSpread = (list, excludeSlotId = null, count = 3) => {
    const chosen = [];
    const seenSlots = new Set(excludeSlotId ? [excludeSlotId] : []);
    const seenDays = new Set();
    for (const s of list) {
      if (seenSlots.has(s.slotId) || seenDays.has(s.date)) continue;
      chosen.push(s);
      seenSlots.add(s.slotId);
      seenDays.add(s.date);
      if (chosen.length >= count) return chosen;
    }
    for (const s of list) {
      if (seenSlots.has(s.slotId)) continue;
      chosen.push(s);
      seenSlots.add(s.slotId);
      if (chosen.length >= count) break;
    }
    return chosen;
  };

  if (tier1.length) {
    const candidates = [...tier1, ...tier2];
    const alternatives = pickSpread([...tier1, ...tier2, ...hostSlotPool], candidates[0].slotId, 3);
    return { tier: 1, candidates, alternatives };
  }
  if (tier2.length) {
    const alternatives = pickSpread([...tier2, ...hostSlotPool], tier2[0].slotId, 3);
    return { tier: 2, candidates: tier2, alternatives };
  }
  // Tier 3: no overlap → return 3 nearest open host slots so the UI is NEVER empty.
  return { tier: 3, candidates: [], alternatives: pickSpread(hostSlotPool, null, 3) };
}

module.exports = {
  TIER1_WINDOW_MS, HORIZON_DAYS, DEFAULT_MAX_PER_DAY, DEFAULT_MIN_LEAD_HOURS, MAX_HOSTS,
  parseHostConfigs, hostPresentation, upcomingBakuDates, hostSlotAvailable, openHostSlots, planInstantMatch,
};
