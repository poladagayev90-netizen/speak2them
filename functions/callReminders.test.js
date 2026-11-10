const test = require("node:test");
const assert = require("node:assert/strict");
const { dueReminderStep, reminderTtlSeconds, firstName, reminderTag } = require("./callReminders");

const MIN = 60 * 1000;
const H = 60 * MIN;
const START = Date.UTC(2026, 10, 12, 14, 0); // any fixed instant
const booking = (over = {}) => ({ status: "confirmed", startMs: START, createdAt: START - 3 * 24 * H, ...over });

test("each step fires inside its own window", () => {
  assert.equal(dueReminderStep(booking(), START - 24 * H), "24h");
  assert.equal(dueReminderStep(booking(), START - 23 * H), "24h");
  assert.equal(dueReminderStep(booking(), START - 3 * H), "24h"); // caught up late
  assert.equal(dueReminderStep(booking(), START - 2 * H), null); // gap before 1 h
  assert.equal(dueReminderStep(booking(), START - H), "1h");
  assert.equal(dueReminderStep(booking(), START - 20 * MIN), "1h");
  assert.equal(dueReminderStep(booking(), START - 15 * MIN), null);
  assert.equal(dueReminderStep(booking(), START - 10 * MIN), "10m");
  assert.equal(dueReminderStep(booking(), START - MIN), "10m");
  assert.equal(dueReminderStep(booking(), START), null);
  assert.equal(dueReminderStep(booking(), START - 25 * H), null);
});

test("a step already sent is not sent again", () => {
  assert.equal(dueReminderStep(booking({ reminded: { "24h": 1 } }), START - 23 * H), null);
  assert.equal(dueReminderStep(booking({ reminded: { "24h": 1 } }), START - 30 * MIN), "1h");
  assert.equal(dueReminderStep(booking({ reminded: { "10m": 1 } }), START - 5 * MIN), null);
});

test("cancelled, moved and done bookings get nothing", () => {
  for (const status of ["cancelled", "moved", "done"]) {
    assert.equal(dueReminderStep(booking({ status }), START - 30 * MIN), null);
  }
});

test("a step whose moment passed before the booking existed is skipped", () => {
  const late = booking({ createdAt: START - 50 * MIN });
  assert.equal(dueReminderStep(late, START - 45 * MIN), null);
  assert.equal(dueReminderStep(late, START - 8 * MIN), "10m");
  const tsLike = booking({ createdAt: { toMillis: () => START - 20 * H } });
  assert.equal(dueReminderStep(tsLike, START - 19 * H), null);
  assert.equal(dueReminderStep(tsLike, START - 40 * MIN), "1h");
});

test("helpers", () => {
  assert.equal(reminderTtlSeconds(START, START - 10 * MIN), 600);
  assert.equal(reminderTtlSeconds(START, START - 10), 60);
  assert.equal(firstName("  Aysel Mammadova "), "Aysel");
  assert.equal(firstName(undefined), "");
  assert.equal(reminderTag("abc"), "call_abc");
});
