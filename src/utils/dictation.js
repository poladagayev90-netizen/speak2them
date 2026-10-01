// Dictation marking: the learner hears a sentence and types it. We compare
// word by word, ignoring case and punctuation (what is heard carries no commas),
// and treat common contractions as the same as their long form so "I'm" and
// "I am" both count. Pure, so it is tested.

const CONTRACTIONS = {
  "i'm": 'i am', "you're": 'you are', "he's": 'he is', "she's": 'she is', "it's": 'it is',
  "we're": 'we are', "they're": 'they are', "don't": 'do not', "doesn't": 'does not',
  "didn't": 'did not', "can't": 'cannot', "won't": 'will not', "isn't": 'is not',
  "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not', "i've": 'i have',
  "i'll": 'i will', "let's": 'let us', "that's": 'that is', "there's": 'there is',
};

export function normalizeWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''))
    .filter(Boolean)
    .flatMap((w) => (CONTRACTIONS[w] ? CONTRACTIONS[w].split(' ') : [w]));
}

// Longest-common-subsequence alignment, so one missed word does not mark every
// word after it wrong. Returns the TARGET words, each marked heard or missed,
// plus a 0–100 score.
export function markDictation(target, typed) {
  const a = normalizeWords(target);
  const b = normalizeWords(typed);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const words = [];
  let i = 0; let j = 0;
  while (i < a.length) {
    if (j < b.length && a[i] === b[j]) { words.push({ word: a[i], ok: true }); i++; j++; }
    else if (j < b.length && dp[i][j + 1] >= dp[i + 1][j]) { j++; }
    else { words.push({ word: a[i], ok: false }); i++; }
  }
  const hits = words.filter((w) => w.ok).length;
  // Extra typed words cost too, or typing every word you know would score 100.
  const extra = Math.max(0, b.length - hits);
  const score = a.length === 0 ? 0 : Math.max(0, Math.round(((hits - extra * 0.5) / a.length) * 100));
  return { words, score };
}

// The sentence as written (capitals, punctuation), each token marked by the
// result above, so the learner reads "Istanbul." rather than "istanbul". A
// token counts as heard only when every word it expands to was heard ("I'm"
// is two words).
export function markOriginal(target, result) {
  const queue = [...result.words];
  return String(target || '').split(/\s+/).filter(Boolean).map((text) => {
    const parts = normalizeWords(text);
    const taken = queue.splice(0, parts.length);
    return { text, ok: taken.length > 0 && taken.every((w) => w.ok) };
  });
}
