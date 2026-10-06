const test = require("node:test");
const assert = require("node:assert");
const { inRoster, rosterSet } = require("./weekRoster");

test("no list for the week means nobody is in it", () => {
  assert.strictEqual(inRoster(null, "a"), false);
  assert.strictEqual(inRoster({}, "a"), false);
  assert.strictEqual(inRoster({ uids: [] }, "a"), false);
});

test("only the chosen are in", () => {
  const r = { uids: ["a", "b"] };
  assert.strictEqual(inRoster(r, "a"), true);
  assert.strictEqual(inRoster(r, "c"), false);
  assert.strictEqual(inRoster(r, ""), false);
});

test("junk entries are ignored", () => {
  assert.deepStrictEqual([...rosterSet({ uids: ["a", 3, null, "", "b"] })], ["a", "b"]);
});

test("auto mode: the planner's verdicts plus the admin's override", () => {
  const doc = { auto: true, autoAt: 1, autoIn: ["a", "b"], include: ["c"], exclude: ["b"] };
  assert.strictEqual(inRoster(doc, "a"), true);
  assert.strictEqual(inRoster(doc, "b"), false); // excluded wins
  assert.strictEqual(inRoster(doc, "c"), true);  // included
  assert.strictEqual(inRoster(doc, "d"), false);
  // Not looked at yet this week: nobody is turned away, except the excluded.
  assert.strictEqual(inRoster({ auto: true, exclude: ["b"] }, "d"), true);
  assert.strictEqual(inRoster({ auto: true, exclude: ["b"] }, "b"), false);
});
