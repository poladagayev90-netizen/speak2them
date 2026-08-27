// The closed grammar taxonomy the analysis LLM is allowed to tag errors with.
//
// WHY A FIXED LIST: error_themes[].title is free-form Azerbaijani/Turkish text
// written by the model. The same mistake came back as "Am/is/are ilə əsas felin
// birlikdə işlədilməsi" in one session and "Köməkçi fel səhvi" in the next, so
// nothing could ever be COUNTED across sessions — no "Articles: used 156,
// mastery 49%" tracker is possible on free text. Every error item now also
// carries a `concept` from this list, and the ids are what the per-user
// aggregate in users/{uid}/insights/grammar is keyed by.
//
// ⚠️ THE ID LIST IS DUPLICATED IN src/data/grammarConcepts.js (the client needs
// the az/tr labels and the CEFR column, which the server has no use for). Same
// arrangement as functions/dailyQuestions.json vs src/data/weeklyContent.js.
// Add an id here first — an id the server does not know is dropped from the
// analysis with a console warning, so drift is loud rather than silent, but an
// id the CLIENT does not know renders as a bare slug in the progress room.
//
// Adding to this list is safe (old aggregates keep their keys). RENAMING an id
// is not: the counters saved under the old id become orphans.

// `en` is the gloss shown to the model in the prompt, nothing else. It has to
// be precise enough that the model picks the same concept for the same mistake
// every time — that repeatability is the entire point of the taxonomy.
const GRAMMAR_CONCEPTS = [
  { id: "articles", en: "a / an / the — wrong or missing article" },
  { id: "present_simple", en: "present simple, including third-person -s" },
  { id: "present_continuous", en: "am/is/are + -ing" },
  { id: "past_simple", en: "past simple, regular and irregular verbs" },
  { id: "past_continuous", en: "was/were + -ing" },
  { id: "present_perfect", en: "have/has + past participle, for / since" },
  { id: "future_forms", en: "will, going to, present continuous for the future" },
  { id: "modals", en: "can, must, should, have to, might" },
  { id: "conditionals", en: "if-clauses" },
  { id: "passive_voice", en: "be + past participle" },
  { id: "verb_patterns", en: "verb + gerund vs verb + infinitive (want to go, enjoy playing)" },
  { id: "prepositions", en: "in, on, at, to, for, of — wrong, missing or extra preposition" },
  { id: "quantifiers", en: "much, many, a lot of, few, little, some, any" },
  { id: "countability", en: "countable vs uncountable nouns (informations, advices, a bread)" },
  { id: "plurals", en: "plural noun forms" },
  { id: "pronouns", en: "he/she/it, him/her, this/that, subject vs object pronouns" },
  { id: "possessives", en: "my/mine, his/her, the 's form" },
  { id: "comparatives", en: "comparative and superlative adjectives" },
  { id: "adjective_adverb", en: "adjective vs adverb (good/well), adjective order" },
  { id: "word_order", en: "position of subject, verb, object and adverbs in the sentence" },
  { id: "questions", en: "question formation — do/does/did, question words, inversion" },
  { id: "negation", en: "don't / doesn't / didn't, double negatives" },
  { id: "there_is_are", en: "there is / there are / there was" },
  { id: "subject_verb_agreement", en: "singular vs plural agreement between subject and verb" },
  { id: "conjunctions", en: "and, but, because, so, although" },
  { id: "relative_clauses", en: "who, which, that clauses" },
  { id: "reported_speech", en: "said / told + reported clause" },
  { id: "phrasal_verbs", en: "get up, look for, turn on" },
  { id: "word_choice", en: "wrong word or unnatural collocation (make/do, say/tell)" },
  { id: "l1_transfer", en: "word-for-word translation from the mother tongue" },
];

const CONCEPT_IDS = GRAMMAR_CONCEPTS.map((c) => c.id);
const CONCEPT_ID_SET = new Set(CONCEPT_IDS);

// The block pasted into the analysis prompt. Built once at module load so the
// 30 lines are not re-joined on every analysis.
const CONCEPT_PROMPT_LIST = GRAMMAR_CONCEPTS
  .map((c) => `- ${c.id}: ${c.en}`)
  .join("\n");

function isConceptId(value) {
  return typeof value === "string" && CONCEPT_ID_SET.has(value);
}

module.exports = {
  GRAMMAR_CONCEPTS,
  CONCEPT_IDS,
  CONCEPT_PROMPT_LIST,
  isConceptId,
};
