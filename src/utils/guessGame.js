// Scoring and number handling for the in-call "Guess It" game.
//
// WHY THE DISTANCE IS A RATIO, NOT A SUBTRACTION
// The obvious rule — "whoever is closest wins" — quietly breaks on exactly the
// questions this game is made of. Take "how many hairs on a head" (100,000):
//
//   A guesses      5,000  ->  off by  95,000
//   B guesses    500,000  ->  off by 400,000
//
// Absolute difference hands it to A. But A is 20x under and B is only 5x over,
// so B clearly has the better sense of the number, and every player feels that
// even if they cannot name it. Once answers range from 3 to 3,000,000,000,000,
// subtraction just crowns whoever guessed small.
//
// So distance is |ln(guess / answer)| — how many times off you are, in either
// direction. Being 2x over and 2x under score identically, which is the fair
// version of "closest". This is why every answer in the deck must be a
// POSITIVE number: ln(0) is -Infinity and negatives have no log at all.

// Seconds each player gets to write a number before the round opens itself.
// Shared with Chat.jsx, which stamps the deadline into the call doc — the
// countdown and the deadline must never drift apart.
export const GUESS_ROUND_SECONDS = 45;

// WHY A WINNER COULD COME OUT WRONG (fixed 2026-11-06)
// The round "opens" on each phone when ITS clock passes deadlineMs. Phone
// clocks drift by seconds, so one player saw the answer — and banked a point
// for being the only one who had answered — while the other still had time on
// the clock, typed a closer number and banked a point too. The board then
// flipped the winner and both scores went up.
//
// Two rules close it, and both phones apply them to the same synced data, so
// they always agree:
//  1. A guess counts only if the SERVER stamped it within the round
//     (answeredAt - startedAt, both serverTimestamp, so no phone clock is
//     involved) plus a small grace for network time.
//  2. The point is written only once the result is final: both guesses are
//     in, or GUESS_SETTLE_MS has passed after the local deadline — long enough
//     for a guess made in time to arrive.
export const GUESS_GRACE_MS = 3000;
export const GUESS_SETTLE_MS = 3000;

// The guess as it counts for scoring, or null when it was stamped after the
// round closed. A missing stamp (old app versions, or my own write still on
// its way to the server) is trusted: the input box closes at the local
// deadline, so it can only be late by clock drift, never by a whole round.
export function countedGuess(guess, answeredAtMs, startedAtMs) {
  if (typeof guess !== 'number') return null;
  if (!Number.isFinite(answeredAtMs) || !Number.isFinite(startedAtMs)) return guess;
  return answeredAtMs - startedAtMs <= GUESS_ROUND_SECONDS * 1000 + GUESS_GRACE_MS ? guess : null;
}

// How far off a guess is, as a log-ratio. Bigger = worse. A guess that is
// missing, zero or negative gets Infinity, so it always loses to a real one
// but never crashes the comparison.
export function guessDistance(guess, answer) {
  if (typeof guess !== 'number' || !isFinite(guess) || guess <= 0) return Infinity;
  if (typeof answer !== 'number' || !isFinite(answer) || answer <= 0) return Infinity;
  return Math.abs(Math.log(guess / answer));
}

// "You were 2.4x off" — the human reading of the distance above. Returned as a
// number so the caller decides the wording.
export function guessFactor(guess, answer) {
  const d = guessDistance(guess, answer);
  if (!isFinite(d)) return null;
  return Math.exp(d);
}

// Five bands, chosen so that the common case (someone in the right ballpark)
// still gets praise. Within 1.25x of a number nobody knows is genuinely good.
export function accuracyLabel(guess, answer) {
  const f = guessFactor(guess, answer);
  if (f === null) return { text: 'No answer', tone: 'muted' };
  if (f <= 1.1) return { text: 'Almost exactly right', tone: 'great' };
  if (f <= 1.5) return { text: 'Very close', tone: 'great' };
  if (f <= 3) return { text: 'Close', tone: 'good' };
  if (f <= 10) return { text: `${f.toFixed(0)}x off`, tone: 'ok' };
  return { text: `${f.toFixed(0)}x off`, tone: 'far' };
}

// Decides the round. `entries` is [{ uid, guess }, ...]; returns the uids that
// win. Both uids come back on an exact tie (two people typing 100 for the same
// question is not rare), and nobody wins if neither typed anything.
export function pickWinners(entries, answer) {
  const scored = entries
    .map((e) => ({ uid: e.uid, d: guessDistance(e.guess, answer) }))
    .filter((e) => isFinite(e.d));
  if (scored.length === 0) return [];
  const best = Math.min(...scored.map((e) => e.d));
  // Guesses are typed by hand, so an exact tie means identical numbers; no
  // epsilon fudging needed and none wanted (it would make 1.9x tie with 2.0x).
  return scored.filter((e) => e.d === best).map((e) => e.uid);
}

// Reads what a learner actually types. Accepts "1400", "1 400", "1,400",
// "1.4k", "2m", "3 billion".
//
// The comma is treated as a THOUSANDS separator, never a decimal point, even
// though Azerbaijani and Turkish write 20,5 for twenty and a half. That is a
// deliberate trade: every answer in the deck is a whole number, big numbers
// with grouping ("1,300,000") are the realistic input, and reading "2,500" as
// two and a half would be a silent 1000x error in a game that scores by ratio.
const SUFFIXES = {
  k: 1e3, thousand: 1e3,
  m: 1e6, mln: 1e6, million: 1e6, milyon: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9, milyard: 1e9, milyar: 1e9,
  t: 1e12, trillion: 1e12, trilyon: 1e12,
};

export function parseGuess(raw) {
  if (typeof raw !== 'string') return null;
  let cleaned = raw.trim().toLowerCase().replace(/[\s,]/g, '');
  if (!cleaned) return null;
  // Azerbaijani, Turkish and Russian group thousands with a dot: "1.400" is
  // one thousand four hundred, not 1.4 — read the other way it lost rounds by
  // 1000x. Only the exact grouping shape (1–3 digits, then dot + 3 digits, no
  // suffix) is read so; "1.5", "2.25" and "1.4k" stay decimals.
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/\./g, '');

  const match = cleaned.match(/^(\d+(?:\.\d+)?)([a-zəğışçöü]*)$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (!isFinite(value)) return null;

  const suffix = match[2];
  if (!suffix) return value > 0 ? value : null;

  const multiplier = SUFFIXES[suffix];
  if (!multiplier) return null;
  return value * multiplier > 0 ? value * multiplier : null;
}

// 1300000 -> "1,300,000". Grouping is not decoration here: an unbroken
// 25000000000 is unreadable, and this game is nothing but big numbers.
export function formatNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// The same number in words — "25 billion". Shown under the digits on reveal,
// because "25,000,000,000" is a shape, not a quantity, until someone says it
// out loud. Which is the point of the game.
export function describeNumber(n) {
  if (typeof n !== 'number' || !isFinite(n) || n < 1e6) return null;
  const scales = [
    [1e12, 'trillion'],
    [1e9, 'billion'],
    [1e6, 'million'],
  ];
  for (const [size, word] of scales) {
    if (n >= size) {
      const v = n / size;
      const shown = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
      return `${shown} ${word}`;
    }
  }
  return null;
}
