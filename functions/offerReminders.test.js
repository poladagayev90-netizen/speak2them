const test = require("node:test");
const assert = require("node:assert/strict");
const { offerReminderTargets, reminderAtMs } = require("./offerReminders");

const H = 60 * 60 * 1000;
const T0 = Date.parse("2026-10-04T16:00:00Z"); // Sunday 20:00 Baku
const offer = (extra = {}) => ({
  status: "pending", participants: ["a", "b"], responses: { a: "pending", b: "pending" },
  createdAt: T0, respondBy: T0 + 48 * H, startMs: T0 + 72 * H, ...extra,
});

test("a weekly-plan offer is reminded 12 h after it went out", () => {
  assert.equal(reminderAtMs(offer()), T0 + 12 * H);
  assert.deepEqual(offerReminderTargets(offer(), T0 + 11 * H), []);
  assert.deepEqual(offerReminderTargets(offer(), T0 + 12 * H), ["a", "b"]);
});

test("only the one who has not answered, and only once", () => {
  const o = offer({ responses: { a: "accepted", b: "pending" } });
  assert.deepEqual(offerReminderTargets(o, T0 + 13 * H), ["b"]);
  assert.deepEqual(offerReminderTargets({ ...o, reminded: { b: T0 + 12 * H } }, T0 + 20 * H), []);
});

test("a short refill offer is reminded halfway", () => {
  const o = offer({ respondBy: T0 + 6 * H });
  assert.equal(reminderAtMs(o), T0 + 3 * H);
});

test("never after the answer time, never just before the start, never for closed offers", () => {
  assert.deepEqual(offerReminderTargets(offer(), T0 + 49 * H), []);
  assert.deepEqual(offerReminderTargets(offer({ startMs: T0 + 13 * H }), T0 + 12 * H), []);
  assert.deepEqual(offerReminderTargets(offer({ status: "expired" }), T0 + 13 * H), []);
  assert.deepEqual(offerReminderTargets(offer({ respondBy: undefined }), T0 + 13 * H), []);
});
