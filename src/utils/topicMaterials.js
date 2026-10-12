// Listening + reading materials per topic (src/data/topicMaterials/NN.json,
// NN = the topic's `day`). Written in content/materials, published by
// scripts/upload-materials.cjs, which also puts the audio and pictures in
// Storage. Loading lives in topicMaterialsLoader.js; these are the pure helpers.

export const READING_LEVELS = ['A2', 'B1', 'B2'];

// The learner's level (free text on users.level: "A2", "B1+", "Upper-intermediate"…)
// mapped to the reading they should open first.
export function readingLevelFor(level) {
  const l = String(level || '').toUpperCase();
  if (/^A|BEGIN|ELEMENT|PRE/.test(l)) return 'A2';
  if (/^B2|^C|UPPER|ADVANC/.test(l)) return 'B2';
  return 'B1';
}

// Index of the line being spoken at `t` seconds (lines carry their start `at`).
export function activeLineAt(lines, t) {
  let idx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (typeof lines[i].at === 'number' && lines[i].at <= t + 0.05) idx = i;
    else if (typeof lines[i].at === 'number') break;
  }
  return idx;
}

// The scene picture for line `idx` (scenes carry the line they start `from`).
export function sceneAt(scenes, idx) {
  let s = scenes[0] || null;
  for (const sc of scenes) if (sc.from <= Math.max(idx, 0)) s = sc;
  return s;
}

// Performance tags like "[laughs]" are direction for the voice, not words.
export function spokenText(t) {
  return String(t || '').replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
}

// ── Key vocabulary inside a text ────────────────────────────────────────────
// The topic's words and idioms (weeklyContent: meaning, meaningAZ, meaningTR,
// example) plus a text's own extra phrases, longest first so "boarding pass"
// wins over "pass". Each term matches whole words, case-insensitive, with a
// plural/verb ending ("backpackers", "crashed").
export function buildTerms(topic, extra = []) {
  const seen = new Set();
  const out = [];
  const add = (phrase, src) => {
    const key = String(phrase || '').toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ ...src, phrase: String(phrase).trim(), key });
  };
  (topic?.vocabulary || []).forEach((v) => add(v.word, { ...v, kind: 'word' }));
  (topic?.idioms || []).forEach((v) => add(v.phrase, { ...v, kind: 'idiom' }));
  extra.forEach((w) => add(w.phrase, { meaningAZ: w.az ?? w.meaningAZ, meaningTR: w.tr ?? w.meaningTR, meaning: w.en ?? w.meaning, kind: 'phrase' }));
  return out.sort((a, b) => b.key.length - a.key.length);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Splits `text` into [{ text, term? }] pieces; pieces with a term are the
// matches. Pure, so the highlighter is the same on phone and in the teacher view.
export function splitByTerms(text, terms) {
  const src = String(text || '');
  if (!terms?.length || !src) return [{ text: src }];
  const re = new RegExp(`\\b(${terms.map((t) => esc(t.key)).join('|')})(?:s|es|ed|d|ing)?\\b`, 'gi');
  const byKey = new Map(terms.map((t) => [t.key, t]));
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    out.push({ text: m[0], term: byKey.get(m[1].toLowerCase()) });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}

// Which topic terms a set of texts never uses — the content check run before
// a topic is published (every word and idiom must appear at least once).
export function missingTerms(texts, topic) {
  const all = texts.join(' \n ');
  return buildTerms(topic).filter((t) => !splitByTerms(all, [t]).some((p) => p.term));
}

// The order a question's options are shown in. The scripts were written with the
// right answer mostly second, so showing them as stored taught learners "always B".
// The order is seeded by the question and its options — the same on every screen (a teacher's
// Present view matches the learner's) and on every visit. True / false / not given
// keeps its natural order.
export function optionOrder(q) {
  const idx = (q?.options || []).map((_, i) => i);
  if (q?.type === 'tf' || idx.length < 3) return idx;
  let h = 2166136261;
  for (const ch of String(q.q || '') + q.options.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => { // mulberry32
    h = (h + 0x6D2B79F5) >>> 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = idx.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}
