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
