import { PRACTICE_COPY, practiceText, practiceDayNames } from './practiceCopy';

test('every language has every English key', () => {
  const keys = Object.keys(PRACTICE_COPY.en);
  for (const lang of ['az', 'tr', 'ru']) {
    expect(keys.filter((k) => !(k in PRACTICE_COPY[lang]))).toEqual([]);
  }
});

test('vars, plurals and the English fallback', () => {
  expect(practiceText('az', 'week.open')).toBe('Həftəmi aç');
  expect(practiceText('xx', 'week.open')).toBe('Open my week');
  expect(practiceText('tr', 'topic.day', { day: 22 })).toBe('22. gün');
  expect(practiceText('en', 'answer.title', { n: 1 })).toBe('1 practice needs your answer');
  expect(practiceText('ru', 'checkin.text', { days: 'Пн', n: 3 })).toMatch(/^Пн · 3 практики,/);
  expect(practiceText('ru', 'checkin.text', { days: 'Пн', n: 5 })).toMatch(/5 практик,/);
});

test('day names follow Monday-first order, Sunday last', () => {
  expect(practiceDayNames('en', [0, 1, 3])).toBe('Mon, Wed, Sun');
  expect(practiceDayNames('az', [1, 0])).toBe('Bazar ertəsi, Bazar');
});

test('no copy names a clock hour', () => {
  for (const table of Object.values(PRACTICE_COPY)) {
    for (const v of Object.values(table)) {
      const s = typeof v === 'function' ? v({ n: 2, days: 'x', missed: 1, left: 1, usual: 2 }) : v;
      expect(s).not.toMatch(/\d{1,2}:\d{2}/);
    }
  }
});
