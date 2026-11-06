import {
  parseGuess, pickWinners, countedGuess, GUESS_ROUND_SECONDS, GUESS_GRACE_MS,
} from './guessGame';

describe('parseGuess', () => {
  it('reads a dot as a thousands separator in the grouping shape', () => {
    expect(parseGuess('1.400')).toBe(1400);
    expect(parseGuess('1.400.000')).toBe(1400000);
    expect(parseGuess('25.000')).toBe(25000);
  });

  it('keeps real decimals and suffixes', () => {
    expect(parseGuess('1.5')).toBe(1.5);
    expect(parseGuess('2.25')).toBe(2.25);
    expect(parseGuess('1.4k')).toBe(1400);
    expect(parseGuess('1.500m')).toBe(1500000);
  });

  it('still reads commas and spaces as grouping', () => {
    expect(parseGuess('1,300,000')).toBe(1300000);
    expect(parseGuess('1 400')).toBe(1400);
  });
});

describe('countedGuess', () => {
  const start = 1_000_000;
  const limit = GUESS_ROUND_SECONDS * 1000 + GUESS_GRACE_MS;

  it('counts a guess stamped inside the round', () => {
    expect(countedGuess(50, start + 10_000, start)).toBe(50);
    expect(countedGuess(50, start + limit, start)).toBe(50);
  });

  it('drops a guess stamped after the round closed', () => {
    expect(countedGuess(50, start + limit + 1, start)).toBeNull();
  });

  it('trusts a guess whose stamp is not known yet', () => {
    expect(countedGuess(50, null, start)).toBe(50);
    expect(countedGuess(50, start + limit + 1, null)).toBe(50);
  });

  it('returns null for no guess', () => {
    expect(countedGuess(undefined, start, start)).toBeNull();
  });
});

describe('late guess cannot steal the round', () => {
  it('the in-time guess wins even when the late one is closer', () => {
    const start = 0;
    const late = GUESS_ROUND_SECONDS * 1000 + GUESS_GRACE_MS + 2000;
    const winners = pickWinners([
      { uid: 'a', guess: countedGuess(500, 20_000, start) },
      { uid: 'b', guess: countedGuess(100, late, start) },
    ], 100);
    expect(winners).toEqual(['a']);
  });
});
