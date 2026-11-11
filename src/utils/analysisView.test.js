import { toAnalysisView } from './analysisView';

const neutral = { original: 'He not finish the book.', corrected: 'He did not finish the book.' };

test('a pattern-only item (private sentence) shows its neutral example to the learner', () => {
  const v = toAnalysisView({
    errorThemes: [{ title: 'Past negatives', rule: 'r', items: [{ original: '', corrected: '', concept: 'past_simple', neutralExample: neutral }] }],
  });
  expect(v.errorThemes[0].items[0]).toMatchObject({ ...neutral, generic: true });
  expect(v.teacherView).toBe(false);
});

test('the teacher view of an old report keeps the mistake type with no example', () => {
  const v = toAnalysisView({
    teacherView: true,
    transcript: undefined,
    errorThemes: [{ title: 'Articles', rule: '', count: 3, items: [] }],
  });
  expect(v.teacherView).toBe(true);
  expect(v.errorThemes).toEqual([{ title: 'Articles', rule: '', count: 3, items: [] }]);
});

test("a learner's report still drops a theme with nothing to show", () => {
  const v = toAnalysisView({ errorThemes: [{ title: 'Articles', rule: '', items: [] }] });
  expect(v.errorThemes).toEqual([]);
});
