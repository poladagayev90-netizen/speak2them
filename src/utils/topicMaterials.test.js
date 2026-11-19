import {
  readingLevelFor, activeLineAt, sceneAt, spokenText, optionOrder,
  replayLineAt, nextLineAt, lineTranslation, hasLineTranslations,
  podcastLevelFor, levelEpisode, levelTerms, splitByTerms,
} from './topicMaterials';

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

  test('replayLineAt goes back to the start of the spoken line', () => {
    const lines = [{ at: 1 }, { at: 5 }, { at: 9.5 }];
    expect(replayLineAt(lines, 0.4)).toBe(0); // intro before the first line
    expect(replayLineAt(lines, 3)).toBe(1);
    expect(replayLineAt(lines, 7.2)).toBe(5);
    expect(replayLineAt(lines, 40)).toBe(9.5);
  });

  test('nextLineAt jumps to the following line, null on the last', () => {
    const lines = [{ at: 1 }, { at: 5 }, { at: 9.5 }];
    expect(nextLineAt(lines, 0)).toBe(1);
    expect(nextLineAt(lines, 2)).toBe(5);
    expect(nextLineAt(lines, 5)).toBe(9.5);
    expect(nextLineAt(lines, 10)).toBe(null);
    expect(nextLineAt([], 0)).toBe(null);
  });

  test('line translations: only az/tr, and the button needs one line that has it', () => {
    const line = { t: 'Hi', az: ' Salam ', tr: '' };
    expect(lineTranslation(line, 'az')).toBe('Salam');
    expect(lineTranslation(line, 'tr')).toBe('');
    expect(lineTranslation(line, 'en')).toBe('');
    expect(lineTranslation(null, 'az')).toBe('');
    expect(hasLineTranslations([{ t: 'a' }, { t: 'b' }])).toBe(false);
    expect(hasLineTranslations([{ t: 'a' }, { t: 'b', tr: 'Merhaba' }])).toBe(true);
    expect(hasLineTranslations(undefined)).toBe(false);
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

describe('onlyWords', () => {
  const { onlyWords } = require('./topicMaterials');
  const terms = [{ key: 'commute' }, { key: 'utopia' }, { key: 'rat race' }];

  test('keeps the episode list, any case', () => {
    expect(onlyWords(terms, ['Commute', 'Rat race']).map((t) => t.key)).toEqual(['commute', 'rat race']);
  });

  test('no list keeps every term', () => {
    expect(onlyWords(terms, undefined)).toBe(terms);
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

describe('podcast levels', () => {
  const base = { episode: 25, title: 'Live B1', level: 'B1', hosts: { Leyla: 'x', Sam: 'y' }, cover: 'c.webp', audio: 'live.mp3', lines: [{ s: 'Leyla', t: 'Hi', at: 0 }], chapters: [{ from: 0, image: 'ch1' }], questions: [{ q: 'a' }], talk: ['t'], words: ['Refund'], before: { predict: 'p' } };
  const levels = { A1: { title: 'Easy', audio: 'a1.mp3', duration: 57, lines: [{ s: 'Sam', t: 'Hello', at: 0 }], words: [{ phrase: 'shop', kind: 'word' }] }, B2: { title: 'Hard', lines: [] } };

  test('podcastLevelFor maps free-text levels, B1 when unknown', () => {
    expect(podcastLevelFor('')).toBe('B1');
    expect(podcastLevelFor(undefined)).toBe('B1');
    expect(podcastLevelFor('A1 – Beginner')).toBe('A1');
    expect(podcastLevelFor('Beginner')).toBe('A1');
    expect(podcastLevelFor('A2 – Elementary')).toBe('A2');
    expect(podcastLevelFor('Pre-intermediate')).toBe('A2');
    expect(podcastLevelFor('B1 – Intermediate')).toBe('B1');
    expect(podcastLevelFor('B2')).toBe('B2');
    expect(podcastLevelFor('C1 – Advanced')).toBe('B2');
    expect(podcastLevelFor('Upper-intermediate')).toBe('B2');
  });

  test('levelEpisode uses the level episode and keeps the topic parts', () => {
    const { episode, level, available } = levelEpisode(base, levels, 'A1');
    expect(level).toBe('A1');
    expect(available).toEqual(['A1', 'B1']);
    expect(episode.audio).toBe('a1.mp3');
    expect(episode.title).toBe('Easy');
    expect(episode.level).toBe('A1');
    expect(episode.lines[0].t).toBe('Hello');
    expect(episode.cover).toBe('c.webp');
    expect(episode.talk).toEqual(['t']);
    expect(episode.chapters).toEqual([]);
    expect(episode.questions).toEqual([]);
    expect(episode.before).toBeUndefined();
    expect(episode.words).toBeUndefined();
    expect(episode.levelWords).toEqual([{ phrase: 'shop', kind: 'word' }]);
  });

  test('levelEpisode falls back to the live B1 when the level is missing or has no audio', () => {
    expect(levelEpisode(base, levels, 'A2')).toMatchObject({ episode: base, level: 'B1' });
    expect(levelEpisode(base, levels, 'B2')).toMatchObject({ episode: base, level: 'B1' });
    expect(levelEpisode(base, null, 'A1')).toEqual({ episode: base, level: 'B1', available: ['B1'] });
  });

  test('levelTerms keys drop end punctuation and sort longest first', () => {
    const t = levelTerms([{ phrase: 'shop', kind: 'word', az: 'mağaza' }, { phrase: 'Can I pay by card?', kind: 'chunk' }, { phrase: 'Shop', kind: 'word' }]);
    expect(t.map((x) => x.key)).toEqual(['can i pay by card', 'shop']);
    expect(t[1]).toMatchObject({ phrase: 'shop', meaningAZ: 'mağaza', kind: 'word' });
    const parts = splitByTerms('So, can I pay by card? Yes.', t);
    expect(parts.find((p) => p.term)?.text).toBe('can I pay by card');
  });
});
