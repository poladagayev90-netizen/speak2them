const test = require("node:test");
const assert = require("node:assert");
const {
  ENFORCED_FIELDS, BADGES, seedFrom, awardBadges, creditCall, corrections, touchesGuarded, localHour, dayString, weekKey,
} = require("./userStats");

const DEL = Symbol("delete");
// 2026-09-26 12:00 Baku (a Saturday)
const NOON = Date.parse("2026-09-26T12:00:00+04:00");

test("the server badge list has the same ids as the client's", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../src/badges/config.js"), "utf8");
  const clientIds = [...src.matchAll(/^\s{2}([a-z_]+): badge\(/gm)].map((m) => m[1]).sort();
  assert.deepStrictEqual(Object.keys(BADGES).sort(), clientIds);
});

test("a first call starts the streak and credits minutes", () => {
  const s = creditCall({}, 600, NOON);
  assert.strictEqual(s.callCount, 1);
  assert.strictEqual(s.totalMinutes, 10);
  assert.strictEqual(s.streak, 1);
  assert.strictEqual(s.lastCallDate, dayString(NOON));
  assert.strictEqual(s.currentWeek, "2026-09-21");
  assert.strictEqual(s.currentWeekMinutes, 10);
  assert.strictEqual(s.currentMonth, "2026-09");
});

test("streak: same day holds, next day grows, a gap resets", () => {
  const day1 = creditCall({}, 60, NOON);
  assert.strictEqual(creditCall(day1, 60, NOON + 3600e3).streak, 1);
  assert.strictEqual(creditCall(day1, 60, NOON + 86400e3).streak, 2);
  assert.strictEqual(creditCall(day1, 60, NOON + 3 * 86400e3).streak, 1);
});

test("week and month minutes roll over lazily", () => {
  const old = { currentWeek: "2026-09-14", currentWeekMinutes: 99, currentMonth: "2026-08", currentMonthMinutes: 99 };
  const s = creditCall(old, 120, NOON);
  assert.strictEqual(s.currentWeekMinutes, 2);
  assert.strictEqual(s.currentMonthMinutes, 2);
  assert.strictEqual(weekKey(Date.parse("2026-09-27T23:00:00+04:00")), "2026-09-21"); // Sunday → same week
});

test("badges are awarded once with their rewards", () => {
  const { stats, awarded } = awardBadges(creditCall({}, 60, NOON), { duration: 60, hour: 23 }, {});
  assert.deepStrictEqual(awarded.sort(), ["first_call", "night_owl"]);
  assert.strictEqual(stats.bonusMinutes, 20);
  assert.deepStrictEqual(awardBadges(stats, { duration: 60, hour: 23 }, {}).awarded, []);
});

test("profile badges follow the profile, not the stats", () => {
  assert.deepStrictEqual(awardBadges({}, {}, { bio: "hi", level: "B1" }).awarded, ["profile_pro"]);
  const { stats } = awardBadges({}, {}, { visitedPremium: true });
  assert.strictEqual(stats.premiumDiscountPercent, 10);
});

test("corrections put forged values back and ignore empty-vs-missing", () => {
  const mirror = { callCount: 3, totalMinutes: 12.5, badges: ["first_call"] };
  const forged = { callCount: 999, totalMinutes: 12.5, badges: ["first_call", "legend"], rating: 0, streak: 40, name: "x" };
  assert.deepStrictEqual(corrections(forged, mirror, DEL), { callCount: 3, badges: ["first_call"], streak: DEL });
  assert.deepStrictEqual(corrections({ ...mirror, rating: 0, ratingCount: 0 }, mirror, DEL), {});
});

test("only guarded fields wake the guard", () => {
  assert.strictEqual(touchesGuarded({ online: true, callCount: 1 }, { online: false, callCount: 1 }), false);
  assert.strictEqual(touchesGuarded({ callCount: 1 }, { callCount: 2 }), true);
  assert.strictEqual(touchesGuarded({ bio: "" }, { bio: "hello" }), true);
  assert.strictEqual(touchesGuarded(null, { name: "A", rating: 0, ratingCount: 0 }), false);
  assert.strictEqual(touchesGuarded(null, { callCount: 5 }), true);
});

test("seedFrom keeps only stat fields", () => {
  assert.deepStrictEqual(Object.keys(seedFrom({ callCount: 1, name: "A", email: "x" })), ["callCount"]);
  assert.ok(ENFORCED_FIELDS.includes("bonusMinutes"));
});

test("localHour uses the learner's zone and survives a bad one", () => {
  assert.strictEqual(localHour(NOON, "Asia/Baku"), 12);
  assert.strictEqual(localHour(NOON, "Europe/Istanbul"), 11);
  assert.strictEqual(localHour(NOON, "Not/AZone"), 12);
});
