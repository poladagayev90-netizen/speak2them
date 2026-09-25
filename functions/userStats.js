// Server-owned leaderboard stats.
//
// users/{uid} is written by its owner, so any number on it — minutes, calls,
// streak, rating, badges — could be typed in by hand, and the leaderboard
// ranked on whatever was typed. The truth now lives in userStats/{uid}, which
// no client can read or write (firestore.rules catch-all). The server credits
// calls and ratings there and copies the result onto users/{uid}; the
// guardUserDoc trigger puts every hand-edited field back.
//
// Why a mirror instead of a rules lock: the Android app (every APK up to
// versionCode 19) writes its own stats in the SAME transaction that marks the
// call ended. Denying those fields would fail that transaction, and the call
// would never end for that user — no billing, no post-call screen. With the
// mirror their write still succeeds and is simply corrected a second later.
//
// Pure functions only (no Firestore) so they can be tested — see
// userStats.test.js. src/badges/config.js is the client twin of BADGES; the
// ids and rewards must stay the same.

const ENFORCED_FIELDS = [
  "callCount", "totalMinutes", "streak", "lastCallDate",
  "currentMonth", "currentMonthMinutes", "currentWeek", "currentWeekMinutes",
  "rating", "ratingCount", "receivedFiveStar",
  "badges", "bonusMinutes", "featuresUnlocked", "premiumDiscountPercent", "trialPremiumDays",
];

// Profile fields some badges look at. They stay client-owned (a bio is the
// user's to write); a change to them makes guardUserDoc re-check badges.
const BADGE_INPUT_FIELDS = ["bio", "level", "visitedPremium"];

const BADGES = {
  first_call: { reward: ["bonusMinutes", 10], when: (s) => (s.callCount || 0) >= 1 },
  chatterbox: { reward: ["bonusMinutes", 30], when: (s) => (s.callCount || 0) >= 10 },
  social_butterfly: { reward: ["discountPremium", 15], when: (s) => (s.callCount || 0) >= 50 },
  beginner: { reward: ["bonusMinutes", 15], when: (s) => (s.totalMinutes || 0) >= 60 },
  expert: { reward: ["trialPremium", 3], when: (s) => (s.totalMinutes || 0) >= 1000 },
  legend: { reward: ["discountPremium", 40], when: (s) => (s.totalMinutes || 0) >= 5000 },
  week_warrior: { reward: ["trialPremium", 1], when: (s) => (s.streak || 0) >= 7 },
  monthly_master: { reward: ["trialPremium", 7], when: (s) => (s.streak || 0) >= 30 },
  well_rated: {
    reward: ["bonusMinutes", 10],
    when: (s) => (s.ratingCount || 0) >= 5 && (s.rating || 0) / s.ratingCount >= 4.5,
  },
  night_owl: {
    reward: ["bonusMinutes", 10],
    when: (s, c) => typeof c.hour === "number" && (c.hour >= 22 || c.hour < 2) && (s.callCount || 0) >= 1,
  },
  marathon: { reward: ["bonusMinutes", 20], when: (s, c) => (c.duration || 0) >= 2700 },
  profile_pro: { reward: ["bonusMinutes", 5], when: (s, c, p) => Boolean(p.bio && p.level) },
  century: { reward: ["discountPremium", 30], when: (s) => (s.callCount || 0) >= 100 },
  daily_devotee: { reward: ["trialPremium", 3], when: (s) => (s.streak || 0) >= 14 },
  speed_connector: {
    reward: ["bonusMinutes", 5],
    when: (s, c) => typeof c.matchTime === "number" && c.matchTime <= 30,
  },
  premium_curious: { reward: ["discountPremium", 10], when: (s, c, p) => p.visitedPremium === true },
  five_star: { reward: ["bonusMinutes", 15], when: (s) => s.receivedFiveStar === true },
};

const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
};

// A mirror seeded from a user doc: whatever the doc held BEFORE the write
// being judged is taken as the baseline (the previous state was already
// guarded, or predates the guard).
function seedFrom(userData) {
  return pick(userData || {}, ENFORCED_FIELDS);
}

// Awards every badge the stats now qualify for and applies its reward.
// `call` = { duration, hour, matchTime } for call badges; `profile` = the
// user doc for profile badges. Returns { stats, awarded }.
function awardBadges(stats, call = {}, profile = {}) {
  const have = new Set(Array.isArray(stats.badges) ? stats.badges : []);
  const awarded = Object.keys(BADGES).filter((id) => !have.has(id) && BADGES[id].when(stats, call, profile || {}));
  if (!awarded.length) return { stats, awarded };
  const next = { ...stats, badges: [...have, ...awarded] };
  const features = new Set(Array.isArray(stats.featuresUnlocked) ? stats.featuresUnlocked : []);
  for (const id of awarded) {
    const [type, value] = BADGES[id].reward;
    if (type === "bonusMinutes") next.bonusMinutes = (Number(next.bonusMinutes) || 0) + value;
    if (type === "discountPremium") next.premiumDiscountPercent = Math.max(Number(next.premiumDiscountPercent) || 0, value);
    if (type === "trialPremium") next.trialPremiumDays = (Number(next.trialPremiumDays) || 0) + value;
    if (type === "unlockFeature") features.add(value);
  }
  if (features.size) next.featuresUnlocked = [...features];
  return { stats: next, awarded };
}

// Baku calendar helpers (UTC+4, no DST) — same convention as the rest of the
// backend. `dayString` matches the client's `new Date().toDateString()` shape
// that lastCallDate has always used.
const bakuDate = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date(ms));
const dayString = (ms) => new Date(`${bakuDate(ms)}T00:00:00Z`).toDateString();
function weekKey(ms) {
  const [y, m, d] = bakuDate(ms).split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const monday = new Date(Date.UTC(y, m - 1, d - (weekday === 0 ? 6 : weekday - 1)));
  return monday.toISOString().slice(0, 10);
}

// One finished call added to the stats. Pure: no badges here.
function creditCall(stats, durationSeconds, nowMs) {
  const minutes = durationSeconds / 60;
  const today = dayString(nowMs);
  const yesterday = dayString(nowMs - 86400000);
  let streak = Number(stats.streak) || 0;
  if (stats.lastCallDate === today) { /* already counted today */ } else if (stats.lastCallDate === yesterday) streak += 1;
  else streak = 1;
  const month = bakuDate(nowMs).slice(0, 7);
  const week = weekKey(nowMs);
  return {
    ...stats,
    callCount: (Number(stats.callCount) || 0) + 1,
    totalMinutes: (Number(stats.totalMinutes) || 0) + minutes,
    streak,
    lastCallDate: today,
    currentMonth: month,
    currentMonthMinutes: (stats.currentMonth === month ? Number(stats.currentMonthMinutes) || 0 : 0) + minutes,
    currentWeek: week,
    currentWeekMinutes: (stats.currentWeek === week ? Number(stats.currentWeekMinutes) || 0 : 0) + minutes,
  };
}

// "Nothing" in all its shapes — a doc may hold rating: 0 where the mirror has
// no rating at all, and that is not a forgery worth a write.
const isEmpty = (v) => v === undefined || v === null || v === 0 || v === "" || v === false
  || (Array.isArray(v) && v.length === 0);
const same = (a, b) => (isEmpty(a) && isEmpty(b)) || JSON.stringify(a) === JSON.stringify(b);

// Fields of `userData` that differ from the mirror → the value to put back
// (`deleteValue` for a field the mirror does not have).
function corrections(userData, mirror, deleteValue) {
  const out = {};
  for (const f of ENFORCED_FIELDS) {
    if (same(userData[f], mirror[f])) continue;
    out[f] = mirror[f] === undefined ? deleteValue : mirror[f];
  }
  return out;
}

// Did this write touch anything the guard cares about?
function touchesGuarded(before, after) {
  const fields = [...ENFORCED_FIELDS, ...BADGE_INPUT_FIELDS];
  if (!before) return fields.some((f) => !isEmpty(after[f]));
  return fields.some((f) => !same(before[f], after[f]));
}

// Hour of the day in the user's own zone (night_owl), Baku if unknown.
function localHour(ms, timeZone) {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || "Asia/Baku", hour: "2-digit", hour12: false })
      .format(new Date(ms))) % 24;
  } catch {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", hour12: false })
      .format(new Date(ms))) % 24;
  }
}

module.exports = {
  ENFORCED_FIELDS,
  BADGE_INPUT_FIELDS,
  BADGES,
  seedFrom,
  awardBadges,
  creditCall,
  corrections,
  touchesGuarded,
  localHour,
  dayString,
  weekKey,
};
