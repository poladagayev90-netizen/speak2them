// One episode of the Julian story for one level: the prompt that asks
// the model for it, the check that turns the model's JSON into a safe chapter,
// and the text splitting the TTS needs. Pure — the I/O lives in index.js
// (teacherStory). The bible itself is storyBible.js.
//
// Episode n tells beat n (lesson order) and is shared by every student of the
// level, read before their n-th lesson. The model sees the bible, the
// summaries of that level's earlier episodes and the beat.

const { CHARACTERS, SEASONS, BEATS, WRITING_RULES } = require("./storyBible");

const LEVELS = ["A2", "B1"];
const MAX_EPISODES = BEATS.length;
const str = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const wordCount = (t) => (t.match(/\S+/g) || []).length;

function seasonOf(n) {
  return SEASONS.find((s) => n >= s.lessons[0] && n <= s.lessons[1]) || SEASONS[SEASONS.length - 1];
}

function buildChapterPrompt({ n, level, previous = [] }) {
  const beat = BEATS[n - 1];
  if (!beat) throw new Error("no_such_beat");
  const lvl = WRITING_RULES.levels[level] || WRITING_RULES.levels.B1;
  const season = seasonOf(n);
  const prevBeat = BEATS[n - 2];
  const cast = CHARACTERS.map((c) => `- ${c.name}: ${c.role} WANTS: ${c.want} NEEDS: ${c.need} SECRET (reveal only when a beat says so): ${c.secret} VOICE: ${c.voice}`).join("\n");
  const story = previous.length
    ? previous.map((p) => `Episode ${p.n} — ${p.title}: ${p.summary}`).join("\n")
    : "(This is the first episode.)";

  return `You are writing one episode of a graded-reader novel for adult English learners in Azerbaijan and Turkey. Output ONLY a JSON object.

THE NOVEL: Julian Mammadli, a young lawyer in Baku. Season ${season.n}, "${season.title}". Season question: ${season.question}
Season arc: ${season.arc}

CHARACTERS:
${cast}

WHAT THE READERS HAVE ALREADY READ:
${story}

THIS EPISODE IS EPISODE ${n}: "${beat.title}"
Beat (tell exactly this): ${beat.beat}
It ends on this dilemma, unanswered: ${beat.dilemma}
${prevBeat ? `The previous episode ended on: "${prevBeat.dilemma}". The LISTENING reveals what happened after it.` : "The LISTENING is a short opening scene (a voicemail or phone call) that introduces Julian."}

LEVEL ${level}: reading ${lvl.words[0]}-${lvl.words[1]} words. ${lvl.note}

RULES:
${WRITING_RULES.rules.map((r) => `- ${r}`).join("\n")}

JSON shape:
{
  "title": "episode title, max 6 words",
  "summary": "2 sentences: what happened, for continuity in later episodes",
  "listening": { "kind": "voicemail | phone call | radio clip | conversation", "text": "100-140 words, spoken English, speaker names as 'Name:' at line starts if more than one speaker" },
  "reading": "the episode, ${lvl.words[0]}-${lvl.words[1]} words, paragraphs separated by a blank line, dialogue in double quotes",
  "expressions": [ { "phrase": "copied character for character from the reading, in the same form (if the reading says 'kept it safe', the phrase is 'kept it safe')", "meaning_az": "Azerbaijani meaning", "meaning_tr": "Turkish meaning", "example": "a new example sentence" } ],
  "questions": [ { "question": "comprehension question about the reading", "options": ["three", "short", "options"], "answer": "the correct option, copied exactly" } ],
  "dictation": [ "5 short sentences (6-12 words) copied exactly from the reading" ],
  "dilemma": { "question": "the dilemma as one question", "sideA": "Julian's best reason for one side", "sideB": "his best reason for the other side" }
}
Give 4 or 5 expressions, exactly 3 questions and exactly 5 dictation sentences. The reading MUST be at least ${lvl.words[0]} words — count them.`;
}

// The model's JSON → the stored chapter. Anything malformed is dropped; a
// chapter without a reading, listening or dilemma is refused outright so a
// teacher never approves half an episode.
function normalizeChapter(obj, { n, level }) {
  const o = obj && typeof obj === "object" ? obj : {};
  const reading = typeof o.reading === "string" ? o.reading.replace(/\r/g, "").trim().slice(0, 4000) : "";
  const listening = {
    kind: str(o.listening && o.listening.kind, 30) || "voicemail",
    text: typeof (o.listening && o.listening.text) === "string" ? o.listening.text.replace(/\r/g, "").trim().slice(0, 1200) : "",
  };
  const dilemma = {
    question: str(o.dilemma && o.dilemma.question, 200),
    sideA: str(o.dilemma && o.dilemma.sideA, 300),
    sideB: str(o.dilemma && o.dilemma.sideB, 300),
  };
  if (wordCount(reading) < 120 || wordCount(listening.text) < 40 || !dilemma.question) {
    throw Object.assign(new Error("chapter_incomplete"), { retryable: true });
  }
  const lower = reading.toLowerCase();
  const expressions = (Array.isArray(o.expressions) ? o.expressions : [])
    .map((e) => ({
      phrase: str(e && e.phrase, 60),
      meaningAZ: str(e && e.meaning_az, 160),
      meaningTR: str(e && e.meaning_tr, 160),
      example: str(e && e.example, 200),
    }))
    .filter((e) => e.phrase && lower.includes(e.phrase.toLowerCase()))
    .slice(0, 5);
  const questions = (Array.isArray(o.questions) ? o.questions : [])
    .map((q) => ({
      question: str(q && q.question, 200),
      options: (Array.isArray(q && q.options) ? q.options : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 4),
      answer: str(q && q.answer, 120),
    }))
    .filter((q) => q.question && q.options.length >= 2 && q.options.includes(q.answer))
    .slice(0, 3);
  const dictation = (Array.isArray(o.dictation) ? o.dictation : [])
    .map((s) => str(s, 160))
    .filter((s) => wordCount(s) >= 4 && wordCount(s) <= 16)
    .slice(0, 5);
  return {
    n,
    level,
    words: wordCount(reading),
    beat: BEATS[n - 1].title,
    title: str(o.title, 60) || BEATS[n - 1].title,
    summary: str(o.summary, 400),
    listening,
    reading,
    expressions,
    questions,
    dictation,
    dilemma,
  };
}

// Deepgram's speak endpoint takes at most 2000 characters, so long text goes
// in sentence-sized pieces whose MP3s are joined (MP3 frames concatenate).
// Long enough for its level? A short draft is retried once; the longer of
// the two is kept (a slightly short episode beats no episode).
function longEnough(chapter) {
  const lvl = WRITING_RULES.levels[chapter.level] || WRITING_RULES.levels.B1;
  return chapter.words >= Math.round(lvl.words[0] * 0.85);
}

function splitForTts(text, max = 1800) {
  const sentences = String(text || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) { out.push(cur.trim()); cur = ""; }
    cur += s.length > max ? s.slice(0, max) : s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

module.exports = { LEVELS, MAX_EPISODES, buildChapterPrompt, normalizeChapter, longEnough, splitForTts, seasonOf };
