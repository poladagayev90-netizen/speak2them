// Gemini as the MAIN call analysis (2026-11-10, Polad: the report must come
// from Gemini LISTENING to the call, not DeepSeek reading a transcript) — pure
// helpers, tested in geminiAnalysis.test.js.
//
// A model that only reads a transcript cannot hear a mispronounced word, a
// filler habit, a flat question or how smoothly someone spoke, and it trusts
// every word the speech recogniser got wrong. So Gemini gets the recording
// itself, transcribes it on its own, and writes the usual report (same fields,
// same prompt rules — History, the teacher page and the insights rollup work
// unchanged) plus the sections only the sound can give: delivery ("How you
// sounded", now with intonation), pronunciation ("Say it right": word, how it
// sounded, how it should sound) and best_moment. The prompt and schema are the
// ones the admin-only shadow test ran side by side (analysisShadow.js).
//
// The old path is the FALLBACK, automatic: Gemini switched off, over the
// monthly cap, recording too big, too little time left in the invocation, an
// error, a timeout, an empty transcript or a foreign script in the answer →
// Deepgram transcribes and DeepSeek grades the text, exactly as before.
//
// Switches on `appConfig/analysis` (admin):
//   gemini            false = text path only (default: on)
//   geminiModel       model id (default gemini-3.8-flash)
//   geminiMonthlyUsd  monthly cap, counted in agentUsage/{month}.analysisUsd

const shadow = require('./analysisShadow');

const GEMINI_MODEL_DEFAULT = shadow.SHADOW_MODEL_DEFAULT;
const GEMINI_MONTHLY_USD_DEFAULT = 10;

// Main analysis allowed? On unless the admin switched it off, and under the
// monthly cap.
function geminiAllowed(cfg, usedUsd) {
  const c = cfg || {};
  if (c.gemini === false) return false;
  const cap = Number.isFinite(Number(c.geminiMonthlyUsd)) ? Number(c.geminiMonthlyUsd) : GEMINI_MONTHLY_USD_DEFAULT;
  return (Number(usedUsd) || 0) < cap;
}

function geminiModel(cfg) {
  const m = cfg && cfg.geminiModel;
  return typeof m === 'string' && m ? m : GEMINI_MODEL_DEFAULT;
}

// Gemini's transcript keeps every "um" and restart (the prompt asks for them,
// the delivery section counts them). Speaking pace is words per minute of
// real words, as the recogniser's transcript gave before — so fillers go.
const FILLERS = /\b(?:u+m+|u+h+|e+h+|e+r+m*|a+h+|h+m+|mm+)\b[,.…]*/gi;
function withoutFillers(text) {
  return String(text || '').replace(FILLERS, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = {
  GEMINI_MODEL_DEFAULT,
  GEMINI_MONTHLY_USD_DEFAULT,
  geminiAllowed,
  geminiModel,
  withoutFillers,
};
