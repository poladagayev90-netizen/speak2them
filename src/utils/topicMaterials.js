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

// ── Podcast levels ──────────────────────────────────────────────────────────
// A topic's podcast in three levels (src/data/topicMaterials/levels/NN.json,
// written by scripts/publish-podcast-levels.cjs). A level the topic doesn't have
// falls back to its live B1 episode (`materials.podcast`). There is no B2: Polad
// cut the podcast to A1/A2/B1 (2026-11-19) — B1 is the top level.
export const PODCAST_LEVELS = ['A1', 'A2', 'B1'];

// The learner's level (users.level, free text: "A1 – Beginner", "B1+",
// "Upper-intermediate"…) → the episode to open first. No level, B2 and above = B1.
export function podcastLevelFor(level) {
  const l = String(level || '').toUpperCase().trim();
  if (!l) return 'B1';
  if (/^A1|BEGIN|STARTER/.test(l)) return 'A1';
  if (/^A|ELEMENT|PRE/.test(l)) return 'A2';
  return 'B1';
}

// The episode to play for `level`: the level's own episode when the topic has
// one, else the live B1 episode. The level episode keeps what belongs to the
// topic (hosts, cover, talk prompts) and drops what was written for the live
// script: its chapters (line indexes), «before» guess and questions.
// `available` = the levels the switch offers; B1 is always there.
export function levelEpisode(base, levels, level) {
  const own = levels && typeof levels === 'object' ? levels : {};
  const available = PODCAST_LEVELS.filter((l) => own[l]?.audio || (l === 'B1' && base));
  const lv = PODCAST_LEVELS.includes(level) && own[level]?.audio ? own[level] : null;
  if (!lv) return { episode: base || null, level: 'B1', available };
  const episode = {
    ...(base || {}),
    title: lv.title || base?.title,
    level,
    lines: lv.lines,
    audio: lv.audio,
    duration: lv.duration || 0,
    chapters: [],
    questions: lv.questions || [],
    before: undefined,
    words: undefined,
    levelWords: lv.words || [],
  };
  return { episode, level, available };
}

// A level's word list (core words, phrasal verbs, idioms / chunks) as terms for
// the highlighter and the word card. Chunks end in punctuation ("Can I pay by
// card?"), which a `\b` match can't follow, so the key drops it.
export function levelTerms(words) {
  const seen = new Set();
  const out = [];
  (words || []).forEach((w) => {
    const phrase = String(w?.phrase || '').trim();
    const key = phrase.toLowerCase().replace(/[.!?…]+$/, '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ phrase, key, kind: w.kind || 'word', meaningAZ: w.az, meaningTR: w.tr, meaning: w.en, example: w.example });
  });
  return out.sort((a, b) => b.key.length - a.key.length);
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

// «Again»: where the line being spoken at `t` started (the intro before the
// first timed line → 0). Repeating one line is the A1 learner's main move.
export function replayLineAt(lines, t) {
  const i = activeLineAt(lines, t);
  return i < 0 ? 0 : lines[i].at;
}

// «Next»: the start of the line after the one at `t`; null on the last line.
export function nextLineAt(lines, t) {
  for (let i = activeLineAt(lines, t) + 1; i < lines.length; i += 1) {
    if (typeof lines[i].at === 'number') return lines[i].at;
  }
  return null;
}

// A line's translation into the learner's language (`lines[i].az` / `.tr`).
// No episode carries them yet (2026-11-18); the Translate button in the
// podcast dock appears only for an episode where some line has one, so the
// data can be added episode by episode without touching the component.
export function lineTranslation(line, lang) {
  if (!line || (lang !== 'az' && lang !== 'tr')) return '';
  return String(line[lang] || '').trim();
}

export function hasLineTranslations(lines) {
  return (lines || []).some((l) => lineTranslation(l, 'az') || lineTranslation(l, 'tr'));
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

// An episode's own word list (`words`, Polad 2026-10-12: only what people
// really say). The topic list has rarer words too ("utopia", "colonisation");
// an episode that names its `words` marks and teaches only those. No list =
// every topic word, as the first episodes were written.
export function onlyWords(terms, words) {
  if (!words?.length) return terms;
  const keep = new Set(words.map((w) => String(w).toLowerCase().trim()));
  return terms.filter((t) => keep.has(t.key));
}

// The forms a word takes in a script. The ending rule alone (s/es/ed/d/ing)
// missed most of the levelled word lists (audit 2026-11-26: "looked around",
// "picked it up", "grew up", "woke me up" were chips in Words but never marked
// in the script): phrasal verbs are inflected on the VERB, not the end, and the
// common verbs are irregular. Only the verbs/nouns of the A1–B1 lists are here.
const IRREGULAR = {
  be: ['was', 'were', 'been', 'is', 'are', 'am'], begin: ['began', 'begun'], break: ['broke', 'broken'],
  bring: ['brought'], build: ['built'], buy: ['bought'], catch: ['caught'], choose: ['chose', 'chosen'],
  come: ['came'], do: ['did', 'done', 'does'], drink: ['drank', 'drunk'], drive: ['drove', 'driven'],
  eat: ['ate', 'eaten'], fall: ['fell', 'fallen'], feel: ['felt'], find: ['found'], fly: ['flew', 'flown'],
  forget: ['forgot', 'forgotten'], freeze: ['froze', 'frozen'], get: ['got', 'gotten'], give: ['gave', 'given'],
  go: ['went', 'gone', 'goes'], grow: ['grew', 'grown'], hang: ['hung'], have: ['had', 'has'], hear: ['heard'],
  hold: ['held'], keep: ['kept'], know: ['knew', 'known'], leave: ['left'], lend: ['lent'], lose: ['lost'],
  make: ['made'], meet: ['met'], pay: ['paid'], ride: ['rode', 'ridden'], ring: ['rang', 'rung'], run: ['ran'],
  say: ['said'], see: ['saw', 'seen'], sell: ['sold'], send: ['sent'], shine: ['shone'], sing: ['sang', 'sung'],
  sit: ['sat'], sleep: ['slept'], speak: ['spoke', 'spoken'], spend: ['spent'], stand: ['stood'],
  swim: ['swam', 'swum'], take: ['took', 'taken'], teach: ['taught'], tell: ['told'], think: ['thought'],
  throw: ['threw', 'thrown'], wake: ['woke', 'woken'], wear: ['wore', 'worn'], win: ['won'], write: ['wrote', 'written'],
  child: ['children'], person: ['people'], man: ['men'], woman: ['women'], foot: ['feet'], tooth: ['teeth'],
  knife: ['knives'], life: ['lives'], wife: ['wives'], leaf: ['leaves'],
};
// Between a verb and its particle: "picked it up", "wake me up", "turn it down".
const OBJECT_PRONOUN = '(?:it|me|you|him|her|us|them|this|that)';

function wordForms(w) {
  const alts = [`${esc(w)}(?:s|es|ed|d|ing)?`];
  if (/e$/.test(w)) alts.push(`${esc(w.slice(0, -1))}ing`); // dance → dancing
  if (/[^aeiou]y$/.test(w)) alts.push(`${esc(w.slice(0, -1))}(?:ies|ied)`); // carry → carried
  if (w.length <= 4 && /[^aeiou][aeiou][^aeiouwxy]$/.test(w)) alts.push(`${esc(w)}${w.slice(-1)}(?:ed|ing|er)`); // chop → chopped
  if (Object.prototype.hasOwnProperty.call(IRREGULAR, w)) IRREGULAR[w].forEach((f) => alts.push(esc(f)));
  return `(?:${alts.join('|')})`;
}

// One term → its pattern. Multi-word terms inflect the first word ("costs an arm
// and a leg", "looking forward to"); a two-word phrasal verb may take an object
// pronoun before its particle. Chunks («Can I pay by card?») are fixed phrases.
function termPattern(t) {
  const words = t.key.split(/\s+/).filter(Boolean);
  if (t.kind === 'chunk') return `${words.map(esc).join('\\s+')}`;
  if (words.length === 1) return wordForms(words[0]);
  const [head, ...rest] = words;
  const gap = t.kind === 'phrasal' && rest.length === 1 ? `(?:\\s+${OBJECT_PRONOUN})?` : '';
  return `${wordForms(head)}${gap}\\s+${rest.map(esc).join('\\s+')}(?:s|es|ed|d|ing)?`;
}

// The regex for a term list, built once per list (the lists are memoised in
// the components; a line re-renders on every timeupdate while it plays).
const reCache = new WeakMap();
function termsRegex(terms) {
  let re = reCache.get(terms);
  if (!re) {
    re = new RegExp(`\\b(?:${terms.map((t) => `(${termPattern(t)})`).join('|')})\\b`, 'gi');
    reCache.set(terms, re);
  }
  re.lastIndex = 0;
  return re;
}

// Splits `text` into [{ text, term? }] pieces; pieces with a term are the
// matches. Pure, so the highlighter is the same on phone and in the teacher view.
// Each term is its own group, so a match maps back to its term whatever form it took.
export function splitByTerms(text, terms) {
  const src = String(text || '');
  if (!terms?.length || !src) return [{ text: src }];
  const re = termsRegex(terms);
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    const g = m.findIndex((x, i) => i > 0 && x !== undefined);
    out.push({ text: m[0], term: terms[g - 1] });
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
