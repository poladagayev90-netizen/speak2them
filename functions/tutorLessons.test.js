const test = require("node:test");
const assert = require("node:assert");
const { bakuMs, parseTime, weeklyDates, suggestTopics, numberHeld } = require("./tutorLessons");

const iso = (ms) => new Date(ms).toISOString();

test("Baku wall clock becomes UTC (UTC+4, no DST)", () => {
  assert.strictEqual(iso(bakuMs("2026-10-06", "19:00")), "2026-10-06T15:00:00.000Z");
  assert.strictEqual(iso(bakuMs("2026-01-06", "19:00")), "2026-01-06T15:00:00.000Z");
  assert.strictEqual(bakuMs("2026-10-06", "25:00"), null);
  assert.strictEqual(parseTime("7:30"), 450);
});

test("a weekly pattern gives the lessons in date order", () => {
  // 2026-10-05 is a Monday. Wed + Fri 19:00.
  const d = weeklyDates({ days: [3, 5], time: "19:00", from: "2026-10-05", count: 4 });
  assert.deepStrictEqual(d.map(iso), [
    "2026-10-07T15:00:00.000Z", "2026-10-09T15:00:00.000Z",
    "2026-10-14T15:00:00.000Z", "2026-10-16T15:00:00.000Z",
  ]);
});

test("the start date counts, and lessons already started are skipped", () => {
  const d = weeklyDates({ days: [1], time: "10:00", from: "2026-10-05", count: 2 });
  assert.strictEqual(iso(d[0]), "2026-10-05T06:00:00.000Z");
  const later = weeklyDates({ days: [1], time: "10:00", from: "2026-10-05", count: 2, notBeforeMs: d[0] });
  assert.strictEqual(iso(later[0]), "2026-10-12T06:00:00.000Z");
  assert.strictEqual(later.length, 2);
});

test("nothing is planned from a bad pattern", () => {
  assert.deepStrictEqual(weeklyDates({ days: [], time: "19:00", from: "2026-10-05", count: 3 }), []);
  assert.deepStrictEqual(weeklyDates({ days: [2], time: "x", from: "2026-10-05", count: 3 }), []);
  assert.strictEqual(weeklyDates({ days: [2], time: "19:00", from: "2026-10-05", count: 500 }).length, 30);
});

test("topics follow the course after the latest one and skip used ones", () => {
  assert.deepStrictEqual(suggestTopics([], 3, 60), [0, 1, 2]);
  assert.deepStrictEqual(suggestTopics([4, 9], 2, 60), [10, 11]);
  assert.deepStrictEqual(suggestTopics([10, 11, 9], 3, 60), [12, 13, 14].map((t) => t));
  assert.deepStrictEqual(suggestTopics([58, 0], 3, 60), [1, 2, 3]);
  // All used: wraps round instead of stopping.
  assert.deepStrictEqual(suggestTopics([0, 1], 3, 2), [0, 1, 0]);
});

test("held lessons are numbered by date; cancelled and planned ones are not", () => {
  const n = numberHeld([
    { id: "c", at: 300, status: "held" },
    { id: "a", at: 100, status: "held" },
    { id: "b", at: 200, status: "cancelled" },
    { id: "d", at: 400, status: "planned" },
  ]);
  assert.deepStrictEqual([...n.entries()], [["a", 1], ["c", 2]]);
});
