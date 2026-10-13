import { pronounceSlug, recordedUrl } from './pronounce';

test('slug: lower case, words joined by dashes, apostrophes dropped', () => {
  expect(pronounceSlug('Jet lag')).toBe('jet-lag');
  expect(pronounceSlug('Off the beaten track')).toBe('off-the-beaten-track');
  expect(pronounceSlug("Don't count your chickens")).toBe('dont-count-your-chickens');
  expect(pronounceSlug('  Well-being! ')).toBe('well-being');
});

test('only recorded words get a URL', () => {
  expect(recordedUrl('zzqx not a word')).toBeNull();
  expect(recordedUrl('')).toBeNull();
});
