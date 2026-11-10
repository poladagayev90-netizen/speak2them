import { codeStem, suggestTeacherCode } from './teacherCode';

const SERVER_RULE = /^[A-Z0-9]{4,12}$/;

test('first name, upper-cased, plus four digits', () => {
  expect(suggestTeacherCode('Polad Aghayev', () => 0.1117)).toBe('POLAD2005');
});

test('Azerbaijani letters become A–Z', () => {
  expect(codeStem('Şəbnəm')).toBe('SEBNEM');
  expect(codeStem('Aytac İsmayılova')).toBe('AYTAC');
  expect(codeStem('Gülçin')).toBe('GULCIN');
});

test('Cyrillic names are transliterated', () => {
  expect(codeStem('Наргиз')).toBe('NARGIZ');
});

test('long names are cut so the code stays within 12', () => {
  const code = suggestTeacherCode('Bartholomew', () => 0.999);
  expect(code).toBe('BARTHOLO9991');
  expect(code).toMatch(SERVER_RULE);
});

test('no usable letters → TEACHER', () => {
  expect(codeStem('')).toBe('TEACHER');
  expect(codeStem('   ')).toBe('TEACHER');
  expect(codeStem('🙂')).toBe('TEACHER');
  expect(codeStem('A')).toBe('TEACHER');
});

test('every suggestion passes the server rule', () => {
  ['Polad', 'Ə', 'Nərgiz Nəcəf', 'Jo', 'x'.repeat(40), null].forEach((n) => {
    expect(suggestTeacherCode(n)).toMatch(SERVER_RULE);
  });
});
