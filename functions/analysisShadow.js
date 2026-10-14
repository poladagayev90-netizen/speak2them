// Gemini analysis SHADOW (2026-10-14) — pure helpers, tested in
// analysisShadow.test.js.
//
// While `appConfig/analysis.shadowGemini` is on, the queue worker sends the
// SAME recording it just analysed (Deepgram → DeepSeek) to Gemini, which hears
// the audio itself, and stores the answer in admin-only
// `callAnalysisShadow/{id}`. The learner never sees it: it exists so the admin
// can compare the two reports side by side before the analysis is switched.
//
// Gemini returns the usual report (same fields, same prompt rules) PLUS three
// sections only a model that hears the voice can give — Polad picked them
// 2026-10-14 (the report keeps its old style, these are added on top):
//   delivery       — "How you sounded": fillers, hesitations, the smoothest bit
//   pronunciation  — "Say it right": up to 3 words that sounded wrong
//   best_moment    — "Your best moment": one strong sentence and why
//
// What the recording is NOT (src/utils/localRecorder.js): only the learner's
// own microphone, and every silence longer than ~1.5 s is cut out while
// recording. So a pause length in seconds, a timestamp, or "long silence" can
// never be measured from it — the prompt forbids them and nothing here stores
// any.

const SHADOW_MODEL_DEFAULT = 'gemini-3.8-flash';
const SHADOW_MONTHLY_USD_DEFAULT = 3;
// Inline request data is capped at 20 MB; base64 adds a third. A 30-minute
// Opus recording is ~5–8 MB, so this only trips on something unusual.
const MAX_INLINE_AUDIO_BYTES = 14 * 1024 * 1024;

const AUDIO_HEADER = `AUDIO:
The attached recording is ONE learner's own microphone during a live English practice call with a partner. The partner cannot be heard. While recording, every silence longer than about 1.5 seconds was cut out, so the file is shorter than the call.
- You HEAR the learner. Transcribe what they say yourself and base every quote on what you hear.
- NEVER mention pause lengths in seconds, timestamps, long silences, or the partner — none of these can be known from this file.
- Accent is not a mistake. Report a pronunciation problem only when a word clearly sounded wrong enough to confuse a listener.`;

const AUDIO_EXTRA_RULES = `
EXTRA FIELDS (you can hear the voice — use it):
- transcript: the learner's English exactly as spoken, including fillers ("um", "eh") and restarts. Skip noise and non-English.
- delivery.fillers: up to 5 filler words or sounds they used more than twice, with how many times. Empty if none.
- delivery.hesitation: up to 3 short {{LANGUAGE}} notes on HOW they hesitated inside sentences (restarting a sentence, repeating a word while searching, stopping mid-phrase) — each with a short English quote of where. Empty if they spoke smoothly.
- delivery.smoothest: one {{LANGUAGE}} sentence naming the part where they spoke most freely, quoting a few of their English words.
- pronunciation: up to 3 English words that clearly sounded wrong. word = the English word; heard = a simple respelling of how it sounded (e.g. "com-FOR-ta-ble", "tink"); tip = {{LANGUAGE}}, one sentence on how to say it; times = how many times it happened. Empty array if nothing clearly wrong — never pad.
- best_moment: the single best English sentence they said (near-verbatim quote) and why = {{LANGUAGE}}, one sentence on what made it good.`;

// The text prompt carries its transcript in a """…""" block. For the shadow
// that block becomes the audio description, and the extra rules go in before
// the concept list. Everything else — voice, honesty, themes — is identical,
// so the comparison is about the model and the audio, not about the prompt.
function buildShadowPrompt(textPrompt, languageName) {
  const lang = languageName || 'Azerbaijani';
  let out = String(textPrompt).replace(/TRANSCRIPT:\s*"""[\s\S]*?"""/, AUDIO_HEADER);
  const extras = AUDIO_EXTRA_RULES.replace(/\{\{LANGUAGE\}\}/g, lang);
  const marker = '\nCONCEPT LIST';
  out = out.includes(marker) ? out.replace(marker, `${extras}\n${marker}`) : out + extras;
  return out;
}

const EXTRA_PROPERTIES = {
  transcript: { type: 'string' },
  delivery: {
    type: 'object',
    required: ['fillers', 'hesitation', 'smoothest'],
    properties: {
      fillers: {
        type: 'array', maxItems: 5,
        items: {
          type: 'object', required: ['word', 'count'],
          properties: { word: { type: 'string' }, count: { type: 'integer', minimum: 1, maximum: 500 } },
        },
      },
      hesitation: { type: 'array', maxItems: 3, items: { type: 'string' } },
      smoothest: { type: 'string' },
    },
  },
  pronunciation: {
    type: 'array', maxItems: 3,
    items: {
      type: 'object', required: ['word', 'heard', 'tip', 'times'],
      properties: {
        word: { type: 'string' }, heard: { type: 'string' }, tip: { type: 'string' },
        times: { type: 'integer', minimum: 1, maximum: 100 },
      },
    },
  },
  best_moment: {
    type: 'object', required: ['quote', 'why'],
    properties: { quote: { type: 'string' }, why: { type: 'string' } },
  },
};

// JSON Schema (the one the Groq strict path uses) → Gemini responseSchema
// (OpenAPI subset): upper-case types, no additionalProperties.
function toGeminiSchema(node) {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    // minItems/maxItems go too: with every list cap AND the concept enums the
    // analysis schema is over Gemini's size limit (400 INVALID_ARGUMENT,
    // bisected 2026-10-14). The caps are in the prompt, and normalizeAnalysis
    // / normalizeExtras slice every list anyway — DeepSeek runs without any
    // schema at all.
    if (k === 'additionalProperties' || k === 'minItems' || k === 'maxItems') continue;
    if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
    else if (k === 'properties') {
      out.properties = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, toGeminiSchema(s)]));
    } else out[k] = toGeminiSchema(v);
  }
  return out;
}

function shadowSchema(analysisSchema) {
  const base = analysisSchema || { type: 'object', properties: {}, required: [] };
  const out = toGeminiSchema({
    ...base,
    required: ['transcript', ...(base.required || []), 'delivery', 'pronunciation', 'best_moment'],
    properties: { transcript: EXTRA_PROPERTIES.transcript, ...base.properties, ...EXTRA_PROPERTIES },
  });
  // Gemini answers 400 INVALID_ARGUMENT to the 30-id concept enum four levels
  // deep (error_themes → items → concept; checked 2026-10-14 — the same enum in
  // concepts_used, two levels deep, is accepted). The prompt lists the ids and
  // normalizeAnalysis throws away any id not in the taxonomy, so the theme
  // items lose only the API-side check.
  const concept = out.properties?.error_themes?.items?.properties?.items?.items?.properties?.concept;
  if (concept) delete concept.enum;
  return out;
}

const normText = (v) => String(v || '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// Same tolerance as normalizeAnalysis: most of the quote's words must be there.
function quotedIn(transcript, quote) {
  const hay = normText(transcript);
  const needle = normText(quote);
  if (!needle || !hay) return false;
  if (hay.includes(needle)) return true;
  const words = needle.split(' ').filter((w) => w.length > 2);
  if (!words.length) return false;
  return words.filter((w) => hay.includes(w)).length / words.length >= 0.7;
}

const asStr = (v) => (typeof v === 'string' ? v.trim() : '');
const SECONDS_TALK = /\b\d+(?:[.,]\d+)?\s*(?:s|sec|secs|seconds?|saniy\w*)\b|\b\d{1,2}:\d{2}\b/i;

// The three new sections, checked against Gemini's own transcript: a quote
// that is not there is dropped, and any line that talks in seconds or clock
// times is dropped too (the file cannot know them — see the header).
function normalizeExtras(raw, transcript) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const d = obj.delivery && typeof obj.delivery === 'object' ? obj.delivery : {};
  const hay = normText(transcript);
  const fillers = (Array.isArray(d.fillers) ? d.fillers : [])
    .map((f) => ({ word: asStr(f?.word).toLowerCase(), count: Math.round(Number(f?.count)) }))
    .filter((f) => f.word && f.count > 0 && f.count <= 500)
    .slice(0, 5);
  const hesitation = (Array.isArray(d.hesitation) ? d.hesitation : [])
    .map(asStr).filter((s) => s && !SECONDS_TALK.test(s)).slice(0, 3);
  const smoothest = SECONDS_TALK.test(asStr(d.smoothest)) ? '' : asStr(d.smoothest);
  const pronunciation = (Array.isArray(obj.pronunciation) ? obj.pronunciation : [])
    .map((p) => ({
      word: asStr(p?.word), heard: asStr(p?.heard), tip: asStr(p?.tip),
      times: Math.max(1, Math.round(Number(p?.times)) || 1),
    }))
    // The word must be one they actually said.
    .filter((p) => p.word && p.heard && p.tip && hay.includes(normText(p.word)))
    .slice(0, 3);
  const bm = obj.best_moment && typeof obj.best_moment === 'object' ? obj.best_moment : {};
  const best = asStr(bm.quote) && asStr(bm.why) && quotedIn(transcript, bm.quote)
    ? { quote: asStr(bm.quote), why: asStr(bm.why) }
    : null;
  return {
    delivery: (fillers.length || hesitation.length || smoothest) ? { fillers, hesitation, smoothest } : null,
    pronunciation,
    bestMoment: best,
  };
}

function shadowAllowed(cfg, usedUsd) {
  const c = cfg || {};
  if (c.shadowGemini !== true) return false;
  const cap = Number.isFinite(Number(c.shadowMonthlyUsd)) ? Number(c.shadowMonthlyUsd) : SHADOW_MONTHLY_USD_DEFAULT;
  return (Number(usedUsd) || 0) < cap;
}

function audioMimeType(storagePath) {
  return String(storagePath || '').includes('.mp4') ? 'audio/mp4' : 'audio/webm';
}

// One line per shadow doc for the admin list: how the two reports differ.
function compareAnalyses(main, shadow) {
  const fixes = (a) => (Array.isArray(a?.errorThemes) ? a.errorThemes : [])
    .flatMap((t) => (Array.isArray(t?.items) ? t.items : []))
    .map((i) => normText(i?.corrected)).filter(Boolean);
  const a = fixes(main);
  const b = fixes(shadow);
  const setA = new Set(a);
  const both = b.filter((x) => setA.has(x)).length;
  const sc = (x, k) => (Number.isFinite(x?.scores?.[k]) ? x.scores[k] : null);
  const delta = (k) => (sc(main, k) == null || sc(shadow, k) == null ? null : sc(shadow, k) - sc(main, k));
  const words = (t) => (normText(t) ? normText(t).split(' ').length : 0);
  return {
    mainFixes: a.length,
    shadowFixes: b.length,
    sameFixes: both,
    scoreDelta: { fluency: delta('fluency'), grammar: delta('grammar'), vocabulary: delta('vocabulary') },
    mainWords: words(main?.transcript),
    shadowWords: words(shadow?.transcript),
  };
}

module.exports = {
  SHADOW_MODEL_DEFAULT,
  SHADOW_MONTHLY_USD_DEFAULT,
  MAX_INLINE_AUDIO_BYTES,
  buildShadowPrompt,
  toGeminiSchema,
  shadowSchema,
  normalizeExtras,
  quotedIn,
  shadowAllowed,
  audioMimeType,
  compareAnalyses,
};
