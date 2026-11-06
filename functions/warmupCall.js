// The WARM-UP CALL (2026-11-06) — pure helpers, tested in warmupCall.test.js.
//
// A newcomer's first voice in the app: a short spoken chat with AInur through
// the Gemini Live API, before their first conversation with a real partner.
// Polad's rule for it: SpeakLab is practice with REAL people, and the warm-up
// is a one-time bridge to that — it never becomes "the AI practice". So:
//   - one per learner (a second try only when the first one ended early),
//   - nobody who has already had a real call gets one,
//   - AInur herself says, at the end, that a real partner comes next,
//   - the screen after it leads to partners, nowhere else.
//
// How it runs: the browser talks to Gemini directly over a WebSocket (audio
// both ways in real time, so she can be interrupted like a person). The API key
// never leaves the server — `warmupCallStart` mints a one-use EPHEMERAL token
// whose Live config (model, voice, the whole system prompt) is fixed on the
// server, and whose expiry is the hard length cap. `warmupCallEnd` records the
// call and picks one thing the learner said well for the closing screen.
//
// Prices (aistudio.google.com/docs/pricing, read 2026-11-06): gemini-3.8-live
// audio in $0.005/min, audio out $0.018/min — but a Live session re-bills its
// whole context every turn, so the real cost grows with length. The budget
// therefore reserves a fixed, generous amount per started call
// (RESERVE_USD) instead of trusting a client-side count.

const MODEL_DEFAULT = 'gemini-3.8-live';
// A warm, clear female voice for AInur (Gemini prebuilt voices).
const VOICE_DEFAULT = 'Aoede';
const MONTHLY_USD_DEFAULT = 15;
// What one started call counts against the monthly budget. The typical call is
// ~$0.04; the ceiling with full context re-billing is ~$0.20.
const RESERVE_USD = 0.15;

// Length. The client wraps up at WRAP_AT_SECONDS (AInur's goodbye takes
// ~20 s) and hangs up at MAX_SECONDS; the token itself stops working a little
// after that, so a modified client cannot keep the line open.
const MAX_SECONDS = 240;
const WRAP_AT_SECONDS = 170;
const TOKEN_GRACE_SECONDS = 45;
// The learner has a minute to open the line after the token is minted.
const CONNECT_WINDOW_SECONDS = 60;

// A first try that ended before this many seconds (dropped line, closed tab)
// does not count — the learner gets one more.
const COMPLETE_MIN_SECONDS = 60;
const MAX_ATTEMPTS = 2;

const L1_NAMES = { az: 'Azerbaijani', tr: 'Turkish', ru: 'Russian', en: 'English' };

function warmupConfig(raw) {
  const c = raw || {};
  const usd = Number(c.monthlyUsd);
  return {
    // Missing doc = on: Polad approved the feature (2026-11-06); the switch is
    // there to turn it OFF.
    enabled: c.enabled !== false,
    monthlyUsd: Number.isFinite(usd) && usd >= 0 ? usd : MONTHLY_USD_DEFAULT,
    model: typeof c.model === 'string' && c.model ? c.model : MODEL_DEFAULT,
    voice: typeof c.voice === 'string' && c.voice ? c.voice : VOICE_DEFAULT,
  };
}

// Who may start a warm-up now. `record` = warmupCalls/{uid} (or null).
// The admin skips everything except the switch and the budget, to test it.
function warmupEligibility({ user, record, cfg, spentUsd = 0, isAdmin = false }) {
  if (!cfg.enabled) return { ok: false, reason: 'off' };
  if (spentUsd + RESERVE_USD > cfg.monthlyUsd) return { ok: false, reason: 'budget' };
  if (isAdmin) return { ok: true };
  const u = user || {};
  if (u.role === 'teacher') return { ok: false, reason: 'teacher' };
  if (Number(u.callCount) > 0) return { ok: false, reason: 'practised' };
  const r = record || {};
  if (r.completedAt) return { ok: false, reason: 'done' };
  if ((Number(r.attempts) || 0) >= MAX_ATTEMPTS) return { ok: false, reason: 'attempts' };
  return { ok: true };
}

function cleanName(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  // Only letters (any script), apostrophe and hyphen reach the prompt.
  return first.replace(/[^\p{L}'-]/gu, '').slice(0, 30);
}

// `guide` = levelGuide(level) from index.js (the same words-per-sentence /
// grammar / vocabulary limits AInur's activities use).
function buildWarmupPrompt({ name, level, l1, guide }) {
  const who = cleanName(name) || 'the learner';
  const lvl = String(level || 'B1').toUpperCase().slice(0, 2);
  const g = guide || { words: '8-14', grammar: 'common tenses', vocab: 'the 3000 most common English words', extra: '' };
  const l1Name = L1_NAMES[l1] || null;
  const l1Rule = l1Name && l1 !== 'en'
    ? `- If they speak ${l1Name}: answer with ONE short, kind sentence in ${l1Name} that gives them a simple English phrase to use, then go straight back to English with an easy question. Never hold a conversation in ${l1Name}.`
    : '- If they speak another language: give them one simple English phrase to use, then ask an easy question in English.';

  return `You are AInur, a warm English speaking partner in the SpeakLab app. SpeakLab is where people practise English with REAL partners. This call is ${who}'s warm-up: a short, relaxed chat right before they meet their first real partner.

GOAL: in about three minutes, ${who} hears their own English working and feels ready to talk to a real person.

HOW YOU SPEAK
- Slowly and clearly, warm and natural, like a friendly person on a phone call.
- Short turns: one or two sentences, then ONE question. ${who} should talk much more than you.
- Their level is ${lvl}: sentences of ${g.words} words, ${g.grammar}, ${g.vocab}. ${g.extra}
- Never correct a mistake and never explain grammar. When they make a mistake, use the right form naturally in your own reply.
- When you praise, name the real thing they said, briefly. Do not say "great job" after every answer.

THE CALL
1. When you receive [start]: greet ${who} by name, say in one sentence that this is a short warm-up before they meet a real partner, and ask an easy question about them (where they are from, or what they do).
2. Then about three simple questions in total, each one building on what they just told you: their day, work or studies, something they enjoy, why English matters to them. Follow up on specific things they mention.
3. When you receive [wrap-up]: finish your sentence, name one specific thing they said well, tell them that next they will talk with a real partner at their level, and say a warm goodbye. Under 25 seconds. Do not ask another question.

WHEN THEY ARE STUCK
- Silence, "sorry?" or "I don't understand": ask the same thing again, slower, with simpler words, or offer two choices ("Do you work or study?").
- One or two words is a fine answer: react to it and ask something easy.
${l1Rule}

YOUR ROLE
- You only do this warm-up chat. If they ask for anything else (translations, homework, long explanations, other services), say kindly that this is a quick warm-up and ask your next question.
- If they ask whether you are a person: say honestly that you are AInur, SpeakLab's AI voice for the warm-up, and that their partner next is a real person.
- Never describe SpeakLab as practice with AI. Do not talk about prices, packages or app features.
- Everything you say is spoken: no emoji, no lists, no stage directions, and never read out the words in square brackets.`;
}

// The Live session config, fixed inside the ephemeral token
// (liveConnectConstraints.config, the SDK's LiveConnectConfig shape).
function liveConfig({ prompt, voice }) {
  return {
    responseModalities: ['AUDIO'],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || VOICE_DEFAULT } } },
    systemInstruction: { parts: [{ text: prompt }] },
    realtimeInputConfig: {
      automaticActivityDetection: {
        // Learners at A1–A2 stop mid-sentence to find a word. The default
        // (~800 ms) answers into that pause; 1.2 s + low end-sensitivity
        // waits for them, at the price of a slightly slower reply. The same
        // lesson as SILENCE_STOP_MS in the AInur activities.
        silenceDurationMs: 1200,
        endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
      },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // A safety net for cost: a four-minute call stays well under the trigger,
    // but a stuck session cannot grow its re-billed context without bound.
    contextWindowCompression: { triggerTokens: 16000, slidingWindow: { targetTokens: 8000 } },
  };
}

function tokenRequestBody({ model, config, nowMs = Date.now() }) {
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return {
    uses: 1,
    expireTime: iso(nowMs + (MAX_SECONDS + CONNECT_WINDOW_SECONDS + TOKEN_GRACE_SECONDS) * 1000),
    newSessionExpireTime: iso(nowMs + CONNECT_WINDOW_SECONDS * 1000),
    liveConnectConstraints: { model: `models/${model}`, config },
  };
}

// What the client reports back: [{ who: 'ai' | 'me', text }]. Bounded, plain.
function cleanLines(lines) {
  if (!Array.isArray(lines)) return [];
  const out = [];
  for (const l of lines.slice(0, 120)) {
    const who = l && l.who === 'ai' ? 'ai' : l && l.who === 'me' ? 'me' : null;
    const text = String((l && l.text) || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    if (who && text) out.push({ who, text });
  }
  return out;
}

const words = (s) => String(s || '').split(/\s+/).filter(Boolean);
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

// The learner's longest line with at least four words — the closing screen's
// fallback when the model call fails.
function fallbackBest(lines) {
  let best = null;
  for (const l of lines) {
    if (l.who !== 'me') continue;
    const n = words(l.text).length;
    if (n >= 4 && (!best || n > words(best).length)) best = l.text;
  }
  return best ? best.slice(0, 160) : null;
}

const BEST_SCHEMA = {
  type: 'OBJECT',
  properties: {
    quote: { type: 'STRING' },
    note: { type: 'STRING' },
  },
  required: ['quote', 'note'],
};

function bestPrompt(lines, l1) {
  const lang = L1_NAMES[l1] || 'English';
  const said = lines.filter((l) => l.who === 'me').map((l) => `- ${l.text}`).join('\n');
  return `A learner of English just finished a three-minute warm-up chat. These are the learner's own lines (speech-to-text, so small transcription slips are possible):
${said}

Pick ONE thing they said well: a complete sentence, a good word choice, or a clear answer. Copy it exactly as written above into "quote" (you may cut it to its best part, at most 20 words; do not fix it).
In "note", write ONE short, warm sentence in ${lang} (max 18 words) saying what was good about it, specifically. Never mention a mistake.`;
}

// The model's quote must really be the learner's words.
function validBest(best, lines) {
  if (!best || typeof best.quote !== 'string' || typeof best.note !== 'string') return null;
  const quote = best.quote.trim().replace(/^["“'«]+|["”'»]+$/g, '').slice(0, 200);
  const note = best.note.trim().slice(0, 240);
  if (words(quote).length < 2 || !note) return null;
  const mine = norm(lines.filter((l) => l.who === 'me').map((l) => l.text).join(' '));
  if (!mine.includes(norm(quote))) return null;
  return { quote, note };
}

module.exports = {
  MODEL_DEFAULT, VOICE_DEFAULT, MONTHLY_USD_DEFAULT, RESERVE_USD,
  MAX_SECONDS, WRAP_AT_SECONDS, COMPLETE_MIN_SECONDS, MAX_ATTEMPTS, L1_NAMES,
  warmupConfig, warmupEligibility, buildWarmupPrompt, liveConfig, tokenRequestBody,
  cleanLines, fallbackBest, BEST_SCHEMA, bestPrompt, validBest, cleanName,
};
