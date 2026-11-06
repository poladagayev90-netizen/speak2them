import { buildLessonSheet, gapSentence } from './lessonSheet';

const topic = {
  topic: 'Travel',
  vocabulary: [
    { word: 'Layover', meaning: 'A stop between flights', example: 'We had a 4-hour layover in Istanbul.' },
    { word: 'Customs', meaning: 'Border control', example: 'We waited an hour at customs.' },
  ],
  questions: { easy: ['Where did you go last?', 'Plane or train?'], hard: ['Is tourism good for a city?'] },
};

test('gapSentence blanks the word, case-insensitive, whole word only', () => {
  expect(gapSentence('We waited an hour at customs.', 'Customs')).toBe('We waited an hour at ______.');
  expect(gapSentence('Customary rules.', 'Custom')).toBeNull();
  expect(gapSentence('', 'x')).toBeNull();
});

test('a learner with no analyses still gets a topic sheet and a plan', () => {
  const s = buildLessonSheet({ themes: [], words: [], personal: { words: [], themes: [], multipleChoice: [], wordOrder: [] } }, topic);
  expect(s.fix).toEqual([]);
  expect(s.words.map((w) => w.word)).toEqual(['Layover', 'Customs']);
  expect(s.gaps).toHaveLength(2);
  expect(s.plan.map((x) => x.title)).toEqual(['Warm-up', 'Words', 'Speaking', 'Wrap-up']);
  expect(s.plan[0].detail).toContain('Where did you go last?');
});

test('their own mistakes and words come first, without repeats', () => {
  const personal = {
    words: [{ word: 'layover', meaning: 'm', example: 'A long layover.' }],
    themes: [{ concept: 'articles', title: 'Articles', rule: 'Use "a" before singular nouns.', examples: [{ original: 'I have car', corrected: 'I have a car' }] }],
    multipleChoice: [], wordOrder: [],
  };
  const s = buildLessonSheet({
    themes: [{ concept: 'articles', label: 'Articles', examples: [{ original: 'I have car', corrected: 'I have a car' }, { original: 'She go', corrected: 'She goes' }] }],
    personal,
  }, topic);
  expect(s.fix.map((f) => f.original)).toEqual(['I have car', 'She go']);
  expect(s.fix[0].rule).toMatch(/singular/);
  expect(s.words.map((w) => w.word)).toEqual(['layover', 'Customs']);
  expect(s.plan[1].title).toBe('Focus: Articles');
});

test('no topic and no brief does not throw', () => {
  const s = buildLessonSheet(null, null);
  expect(s.plan.length).toBeGreaterThan(0);
  expect(s.speak).toBeNull();
});
