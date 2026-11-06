// The printable homework sheet and the teacher's lesson plan, built from what
// teacherStudentBrief returns (the learner's own analyses since the last held
// lesson + the coming lesson's topic). Pure and template-based: no AI call, so
// it costs nothing and is ready the moment the brief arrives. Every exercise
// comes from the learner's own reports or the topic's fixed content — nothing
// is invented here (Polad 2026-11-07: template over a fresh AI write-up).

const MAX_FIX = 6;
const MAX_WORDS = 8;
const MAX_GAPS = 5;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "We had a 4-hour layover." + "Layover" → "We had a 4-hour ______." or null
// when the word is not in the sentence as written.
export function gapSentence(example, word) {
  const ex = String(example || '').trim();
  const w = String(word || '').trim();
  if (!ex || !w) return null;
  const re = new RegExp(`\\b${escapeRe(w)}\\b`, 'i');
  if (!re.test(ex)) return null;
  return ex.replace(re, '______');
}

function pickQuestion(topic, kind, i = 0) {
  const list = topic && topic.questions && Array.isArray(topic.questions[kind]) ? topic.questions[kind] : [];
  return list.length ? list[i % list.length] : null;
}

// brief: { themes, words, personal, nextLesson, lastLesson }
// topic: a weeklyContent entry or null
export function buildLessonSheet(brief, topic) {
  const b = brief || {};
  const p = b.personal || {};
  const themes = Array.isArray(p.themes) ? p.themes : [];
  const briefThemes = Array.isArray(b.themes) ? b.themes : [];

  // 1. Fix the sentence — their own mistakes, newest-pattern first.
  const fix = [];
  const seen = new Set();
  const pushFix = (e, rule) => {
    if (!e || !e.original || !e.corrected || seen.has(e.original) || fix.length >= MAX_FIX) return;
    seen.add(e.original);
    fix.push({ original: e.original, corrected: e.corrected, rule: rule || '' });
  };
  themes.forEach((t) => (t.examples || []).forEach((e) => pushFix(e, t.rule)));
  briefThemes.forEach((t) => (t.examples || []).forEach((e) => pushFix(e, '')));

  // 2. Words — theirs first, then the topic's, one entry per word.
  const words = [];
  const wseen = new Set();
  const pushWord = (w) => {
    const word = String((w && w.word) || '').trim();
    if (!word || wseen.has(word.toLowerCase()) || words.length >= MAX_WORDS) return;
    wseen.add(word.toLowerCase());
    words.push({ word, meaning: String(w.meaning || ''), example: String(w.example || '') });
  };
  (Array.isArray(p.words) ? p.words : []).forEach(pushWord);
  (topic && Array.isArray(topic.vocabulary) ? topic.vocabulary : []).forEach(pushWord);

  // 3. Gap fill from those words' own example sentences.
  const gaps = words
    .map((w) => ({ sentence: gapSentence(w.example, w.word), answer: w.word }))
    .filter((g) => g.sentence)
    .slice(0, MAX_GAPS);

  const multipleChoice = Array.isArray(p.multipleChoice) ? p.multipleChoice : [];
  const wordOrder = Array.isArray(p.wordOrder) ? p.wordOrder : [];
  const speak = pickQuestion(topic, 'hard') || pickQuestion(topic, 'easy');

  // The teacher's plan for the coming lesson (~45 min). Steps with nothing to
  // say are left out rather than padded.
  const plan = [];
  const warm = [pickQuestion(topic, 'easy', 0), pickQuestion(topic, 'easy', 1)].filter(Boolean);
  plan.push({ min: 5, title: 'Warm-up', detail: warm.length ? warm.join(' · ') : 'Ask about their week since the last lesson.' });
  const focus = (themes.length ? themes : briefThemes).slice(0, 2);
  focus.forEach((t, i) => {
    const ex = (t.examples || [])[0];
    plan.push({
      min: i === 0 ? 10 : 8,
      title: `Focus: ${t.title || t.label || t.concept}`,
      detail: [t.rule, ex ? `Their line: "${ex.original}" → "${ex.corrected}"` : ''].filter(Boolean).join(' '),
    });
  });
  if (words.length) plan.push({ min: 7, title: 'Words', detail: words.slice(0, 6).map((w) => w.word).join(', ') });
  plan.push({
    min: 10,
    title: 'Speaking',
    detail: speak ? `${speak} Then debate the dilemma from the story episode they read.` : 'Debate the dilemma from the story episode they read.',
  });
  plan.push({ min: 5, title: 'Wrap-up', detail: 'Give this sheet as homework; check it at the start of the next lesson.' });

  return { plan, fix, words, gaps, multipleChoice, wordOrder, speak };
}
