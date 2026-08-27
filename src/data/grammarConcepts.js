// Labels and CEFR difficulty for the grammar taxonomy.
//
// The ANALYSIS side of this list lives in functions/grammarConcepts.js — that
// file is what the LLM is allowed to tag an error with, and what the per-user
// aggregate in users/{uid}/insights/grammar is keyed by. This file only turns
// those ids into something a learner can read.
//
// ⚠️ KEEP THE IDS IN SYNC WITH functions/grammarConcepts.js. An id the server
// knows and this file does not renders as a bare slug ("subject_verb_agreement")
// in the progress room, so add ids to both files in the same change. Same
// arrangement as functions/dailyQuestions.json vs src/data/weeklyContent.js.
//
// `cefr` is the "Difficulty" column of the tracker and is deliberately the
// level at which the structure is FIRST expected, not where it is mastered.

export const GRAMMAR_CONCEPTS = [
  { id: 'articles', cefr: 'A1', en: 'Articles (a / an / the)', az: 'Artikllər (a / an / the)', tr: 'Artikeller (a / an / the)' },
  { id: 'present_simple', cefr: 'A1', en: 'Present simple', az: 'İndiki qeyri-müəyyən zaman', tr: 'Geniş zaman' },
  { id: 'present_continuous', cefr: 'A1', en: 'Present continuous', az: 'İndiki davamedici zaman', tr: 'Şimdiki zaman' },
  { id: 'past_simple', cefr: 'A2', en: 'Past simple', az: 'Keçmiş qeyri-müəyyən zaman', tr: 'Geçmiş zaman' },
  { id: 'past_continuous', cefr: 'A2', en: 'Past continuous', az: 'Keçmiş davamedici zaman', tr: 'Sürekli geçmiş zaman' },
  { id: 'present_perfect', cefr: 'B1', en: 'Present perfect', az: 'Present Perfect (have/has + III forma)', tr: 'Present Perfect (have/has + 3. hâl)' },
  { id: 'future_forms', cefr: 'A2', en: 'Future forms', az: 'Gələcək zaman formaları', tr: 'Gelecek zaman kalıpları' },
  { id: 'modals', cefr: 'A2', en: 'Modal verbs', az: 'Modal fellər', tr: 'Modal fiiller' },
  { id: 'conditionals', cefr: 'B1', en: 'Conditionals', az: 'Şərt cümlələri', tr: 'Koşul cümleleri' },
  { id: 'passive_voice', cefr: 'B1', en: 'Passive voice', az: 'Məchul növ', tr: 'Edilgen çatı' },
  { id: 'verb_patterns', cefr: 'B1', en: 'Verb patterns (-ing / to)', az: 'Feldən sonra -ing / to', tr: 'Fiilden sonra -ing / to' },
  { id: 'prepositions', cefr: 'A2', en: 'Prepositions', az: 'Sözönləri', tr: 'Edatlar' },
  { id: 'quantifiers', cefr: 'A2', en: 'Quantifiers', az: 'Kəmiyyət bildirənlər', tr: 'Miktar belirteçleri' },
  { id: 'countability', cefr: 'A2', en: 'Countable / uncountable', az: 'Sayıla bilən / sayılmayan isimlər', tr: 'Sayılabilen / sayılamayan isimler' },
  { id: 'plurals', cefr: 'A1', en: 'Plural forms', az: 'Cəm forması', tr: 'Çoğul biçimler' },
  { id: 'pronouns', cefr: 'A1', en: 'Pronouns', az: 'Əvəzliklər', tr: 'Zamirler' },
  { id: 'possessives', cefr: 'A1', en: 'Possessives', az: 'Yiyəlik formaları', tr: 'İyelik biçimleri' },
  { id: 'comparatives', cefr: 'A2', en: 'Comparatives', az: 'Müqayisə dərəcələri', tr: 'Karşılaştırma dereceleri' },
  { id: 'adjective_adverb', cefr: 'A2', en: 'Adjectives and adverbs', az: 'Sifət və zərf', tr: 'Sıfat ve zarf' },
  { id: 'word_order', cefr: 'A1', en: 'Word order', az: 'Söz sırası', tr: 'Sözcük sırası' },
  { id: 'questions', cefr: 'A1', en: 'Question forms', az: 'Sual quruluşu', tr: 'Soru yapısı' },
  { id: 'negation', cefr: 'A1', en: 'Negatives', az: 'İnkar formaları', tr: 'Olumsuzluk' },
  { id: 'there_is_are', cefr: 'A1', en: 'There is / There are', az: 'There is / There are', tr: 'There is / There are' },
  { id: 'subject_verb_agreement', cefr: 'A1', en: 'Subject-verb agreement', az: 'Mübtəda-xəbər uzlaşması', tr: 'Özne-yüklem uyumu' },
  { id: 'conjunctions', cefr: 'A2', en: 'Conjunctions', az: 'Bağlayıcılar', tr: 'Bağlaçlar' },
  { id: 'relative_clauses', cefr: 'B1', en: 'Relative clauses', az: 'Təyin budaq cümlələri', tr: 'Sıfat cümlecikleri' },
  { id: 'reported_speech', cefr: 'B2', en: 'Reported speech', az: 'Dolayı nitq', tr: 'Dolaylı anlatım' },
  { id: 'phrasal_verbs', cefr: 'B1', en: 'Phrasal verbs', az: 'Frazal fellər', tr: 'Öbek fiiller' },
  { id: 'word_choice', cefr: 'B1', en: 'Word choice', az: 'Söz seçimi', tr: 'Sözcük seçimi' },
  { id: 'l1_transfer', cefr: 'A2', en: 'Literal translation', az: 'Ana dildən hərfi tərcümə', tr: 'Ana dilden birebir çeviri' },
];

const BY_ID = new Map(GRAMMAR_CONCEPTS.map((c) => [c.id, c]));

export function getConcept(id) {
  return BY_ID.get(id) || null;
}

// The learner reads the report in their L1, so the tracker uses the same
// language. An id this build does not know still has to render something, so
// the slug is turned back into words rather than dropped.
export function conceptLabel(id, lang = 'az') {
  const c = BY_ID.get(id);
  if (!c) return String(id || '').replace(/_/g, ' ');
  return c[lang] || c.en;
}

export function conceptDifficulty(id) {
  const c = BY_ID.get(id);
  return c ? c.cefr : '';
}

// Mastery is SMOOTHED, not the raw ratio. One mistake on the single attempt we
// happened to see is not 0% mastery — it is one data point, and a tracker that
// opens on a row of zeros reads as broken rather than as honest. The +1/+2
// (Laplace) prior starts every concept near 50% and lets real evidence move it,
// so a concept needs repeated errors to look weak and repeated clean use to
// look strong.
export function conceptMastery({ attempts = 0, errors = 0 } = {}) {
  const a = Math.max(0, Number(attempts) || 0);
  const e = Math.min(a, Math.max(0, Number(errors) || 0));
  if (a === 0) return null; // never used → the UI shows "—", not 50%
  return Math.round(((a - e + 1) / (a + 2)) * 100);
}

// Below this many attempts a percentage is noise; the room labels those rows
// "not enough data yet" instead of printing a confident-looking number.
export const MASTERY_MIN_ATTEMPTS = 4;
