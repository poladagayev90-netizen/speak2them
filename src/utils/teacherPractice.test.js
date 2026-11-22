import { teacherCardVisible, teacherPracticeText } from './teacherPractice';

const newcomer = { uid: 'u', name: 'Aysel', level: 'A2', callCount: 0 };

test('a newcomer before the first call sees it', () => {
  expect(teacherCardVisible(newcomer)).toBe(true);
  expect(teacherCardVisible({ ...newcomer, callCount: undefined })).toBe(true);
});

test('gone after the first real call, a dismissal, or with a teacher', () => {
  expect(teacherCardVisible({ ...newcomer, callCount: 1 })).toBe(false);
  expect(teacherCardVisible({ ...newcomer, warmupDismissedAt: { seconds: 1 } })).toBe(false);
  expect(teacherCardVisible({ ...newcomer, teacherId: 't1' })).toBe(false);
  expect(teacherCardVisible({ ...newcomer, role: 'teacher' })).toBe(false);
  expect(teacherCardVisible(null)).toBe(false);
});

test('the admin sees it to test, until put aside', () => {
  expect(teacherCardVisible({ ...newcomer, callCount: 40 }, { admin: true })).toBe(true);
  expect(teacherCardVisible({ ...newcomer, warmupDismissedAt: 1 }, { admin: true })).toBe(false);
});

test('prefilled WhatsApp line', () => {
  expect(teacherPracticeText(newcomer)).toBe('Salam! Mən Aysel (A2). Müəllimlə pulsuz praktika etmək istəyirəm.');
  expect(teacherPracticeText({})).toContain('SpeakLab istifadəçisiyəm');
});
