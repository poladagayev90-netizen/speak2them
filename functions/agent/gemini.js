// One structured call to the Gemini API, plus what it cost.
//
// Native fetch, no SDK (the codebase convention). The answer is JSON that
// follows `schema` (responseSchema), so there is no free text to parse.
// A 429 / 5xx is retried once; any other failure throws, and the caller falls
// back to the deterministic planner — the AI is never on the critical path.

// $ per 1M tokens (ai.google.dev/gemini-api/docs/pricing, read 2026-10-14).
// gemini-3.8-flash doubles on 2027-01-01.
const PRICES = {
  'gemini-3.8-flash': { in: 0.75, out: 3.75, inFrom2027: 1.5, outFrom2027: 7.5 },
  'gemini-3.5-flash-lite': { in: 0.3, out: 2.5 },
  'gemini-3.1-flash-lite': { in: 0.25, out: 1.5 },
};
const PRICE_STEP_MS = Date.parse('2027-01-01T00:00:00Z');

function costUsd(usage, model, nowMs = Date.now()) {
  const p = PRICES[model] || PRICES['gemini-3.8-flash'];
  const late = nowMs >= PRICE_STEP_MS;
  const inP = late && p.inFrom2027 ? p.inFrom2027 : p.in;
  const outP = late && p.outFrom2027 ? p.outFrom2027 : p.out;
  const u = usage || {};
  const input = Number(u.promptTokenCount) || 0;
  // Thinking tokens are billed as output.
  const output = (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0);
  return { input, output, usd: (input * inP + output * outP) / 1e6 };
}

// `media` = optional inline parts sent before the prompt, e.g. the call
// recording for the analysis shadow: [{ mimeType: 'audio/webm', data: <base64> }].
async function callGemini({ apiKey, model, system, prompt, schema, media = [], maxOutputTokens = 8192, timeoutMs = 90000, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('gemini-no-key');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = JSON.stringify({
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: 'user', parts: [...media.map((m) => ({ inlineData: m })), { text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.2,
      maxOutputTokens,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  });
  let last = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body, signal: ctrl.signal,
      });
      if (r.status === 429 || r.status >= 500) { last = new Error(`gemini-${r.status}`); continue; }
      if (!r.ok) throw new Error(`gemini-${r.status}: ${(await r.text()).slice(0, 200)}`);
      const d = await r.json();
      const text = d?.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '';
      let json;
      try { json = JSON.parse(text); } catch { throw new Error('gemini-bad-json'); }
      return { json, usage: d.usageMetadata || {} };
    } catch (e) {
      if (e.name === 'AbortError') last = new Error('gemini-timeout');
      else throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last || new Error('gemini-failed');
}

module.exports = { PRICES, costUsd, callGemini };
