// What went wrong with an analysis model call — decides both whether a retry
// can help and which alert the admin gets.
//
// The 2026-09-30 "deepseek-down" e-mail was not DeepSeek being down: the answer
// hit max_tokens mid-JSON and JSON.parse failed. The mail then told the admin to
// check the balance and the API key, which was the wrong fix. A cut answer or
// broken JSON is fixed by asking again; only a refused/failed request is an
// outage.

// A model answer that stopped at the token limit.
function truncatedError(provider) {
  return Object.assign(new Error(`${provider} answer truncated at max_tokens`), { llmKind: "truncated" });
}

// A model answer that arrived whole but is not valid JSON.
function badJsonError(provider, cause) {
  return Object.assign(new Error(`${provider} returned invalid JSON: ${cause?.message || cause}`), { llmKind: "bad_json" });
}

// 'truncated' | 'bad_json' | 'down'
function classifyLlmError(e) {
  if (e && (e.llmKind === "truncated" || e.llmKind === "bad_json")) return e.llmKind;
  if (e instanceof SyntaxError) return "bad_json";
  return "down";
}

module.exports = { truncatedError, badJsonError, classifyLlmError };
