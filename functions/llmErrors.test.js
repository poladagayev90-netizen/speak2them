const test = require("node:test");
const assert = require("node:assert");
const { truncatedError, badJsonError, classifyLlmError } = require("./llmErrors");

test("a cut answer is truncated, not an outage", () => {
  assert.strictEqual(classifyLlmError(truncatedError("DeepSeek")), "truncated");
});

test("broken JSON is bad_json, raw SyntaxError too", () => {
  assert.strictEqual(classifyLlmError(badJsonError("DeepSeek", new SyntaxError("x"))), "bad_json");
  let raw;
  try { JSON.parse("{\"a\":[1,2"); } catch (e) { raw = e; }
  assert.strictEqual(classifyLlmError(raw), "bad_json");
});

test("HTTP errors and timeouts are an outage", () => {
  assert.strictEqual(classifyLlmError(new Error("DeepSeek error 402: Insufficient Balance")), "down");
  assert.strictEqual(classifyLlmError(new Error("DeepSeek chat timed out")), "down");
  assert.strictEqual(classifyLlmError(undefined), "down");
});
