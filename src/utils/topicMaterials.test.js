import { readingLevelFor, activeLineAt, sceneAt, spokenText, optionOrder } from './topicMaterials';

describe('topicMaterials', () => {
  test('readingLevelFor maps free-text levels', () => {
    expect(readingLevelFor('A1')).toBe('A2');
    expect(readingLevelFor('A2')).toBe('A2');
    expect(readingLevelFor('Beginner')).toBe('A2');
    expect(readingLevelFor('B1')).toBe('B1');
    expect(readingLevelFor('B1+')).toBe('B1');
    expect(readingLevelFor('B2')).toBe('B2');
    expect(readingLevelFor('C1')).toBe('B2');
    expect(readingLevelFor('Upper-intermediate')).toBe('B2');
    expect(readingLevelFor('')).toBe('B1');
    expect(readingLevelFor(undefined)).toBe('B1');
  });

  test('activeLineAt follows the start times', () => {
    const lines = [{ at: 0 }, { at: 5 }, { at: 9.5 }];
    expect(activeLineAt(lines, 0)).toBe(0);
    expect(activeLineAt(lines, 4.9)).toBe(0);
    expect(activeLineAt(lines, 5)).toBe(1);
    expect(activeLineAt(lines, 30)).toBe(2);
    expect(activeLineAt([{ at: 2 }], 1)).toBe(-1);
  });

  test('sceneAt picks the scene a line falls in', () => {
    const scenes = [{ from: 0, src: 'a' }, { from: 3, src: 'b' }, { from: 12, src: 'c' }];
    expect(sceneAt(scenes, -1).src).toBe('a');
    expect(sceneAt(scenes, 2).src).toBe('a');
    expect(sceneAt(scenes, 3).src).toBe('b');
    expect(sceneAt(scenes, 20).src).toBe('c');
    expect(sceneAt([], 0)).toBe(null);
  });

  test('spokenText drops voice direction tags', () => {
    expect(spokenText('[yawns] Six in the morning.')).toBe('Six in the morning.');
    expect(spokenText('That is [laughs] fine')).toBe('That is fine');
  });
});

describe('key vocabulary', () => {
  const { buildTerms, splitByTerms, missingTerms } = require('./topicMaterials');
  const topic = {
    vocabulary: [{ word: 'Boarding pass', meaningAZ: 'minmə talonu' }, { word: 'Pass', meaningAZ: 'keçid' }, { word: 'Backpacker', meaningAZ: 'səyyah' }, { word: 'Crash', meaningAZ: 'çökmə' }],
    idioms: [{ phrase: 'Hit the road', meaningAZ: 'yola çıxmaq' }],
  };

  test('longest term wins and endings match', () => {
    const terms = buildTerms(topic);
    const parts = splitByTerms('I lost my boarding pass. Two backpackers hit the road; the app crashed.', terms);
    const hits = parts.filter((p) => p.term).map((p) => [p.text, p.term.phrase]);
    expect(hits).toEqual([['boarding pass', 'Boarding pass'], ['backpackers', 'Backpacker'], ['hit the road', 'Hit the road'], ['crashed', 'Crash']]);
    expect(parts.map((p) => p.text).join('')).toBe('I lost my boarding pass. Two backpackers hit the road; the app crashed.');
  });

  test('no partial-word matches', () => {
    const parts = splitByTerms('A passenger passed by.', buildTerms(topic));
    expect(parts.filter((p) => p.term).map((p) => p.text)).toEqual(['passed']);
  });

  test('missingTerms lists unused words', () => {
    expect(missingTerms(['A backpacker with a boarding pass.'], topic).map((t) => t.phrase)).toEqual(['Hit the road', 'Crash']); // "pass" counts inside "boarding pass"
  });

  test('extra phrases carry az/tr', () => {
    const t = buildTerms({}, [{ phrase: 'at first', az: 'əvvəlcə', tr: 'ilk başta' }]);
    expect(t[0]).toMatchObject({ phrase: 'at first', meaningAZ: 'əvvəlcə', meaningTR: 'ilk başta' });
  });
});

describe('optionOrder', () => {
  const q = (text, type = 'detail') => ({ type, q: text, options: ['a', 'b', 'c', 'd'], answer: 1 });

  test('is a stable permutation of the options', () => {
    const o = optionOrder(q('What did Sam see?'));
    expect([...o].sort()).toEqual([0, 1, 2, 3]);
    expect(optionOrder(q('What did Sam see?'))).toEqual(o);
  });

  test('true / false / not given keeps its order', () => {
    expect(optionOrder({ type: 'tf', q: 'x', options: ['True', 'False', 'Not given'] })).toEqual([0, 1, 2]);
  });

  test('the right answer does not stay in one place', () => {
    const spots = new Set(['Why?', 'Where did she go?', 'What is it about?', 'Who is the author?', 'How long is it?', 'What woke Sam up?']
      .map((t) => optionOrder(q(t)).indexOf(1)));
    expect(spots.size).toBeGreaterThan(1);
  });
});
