import {
  ACADEMY_POPUP_MAX_SHOWS,
  shouldShowAcademyPopup,
  markAcademyPopupShown,
  markAcademyOpened,
} from './academyPopup';

beforeEach(() => {
  localStorage.clear();
});

const LEARNER = { uid: 'u1', role: 'student', callCount: 0 };

test('eligible newcomer sees popup up to 3 times, max once per day', () => {
  expect(shouldShowAcademyPopup(LEARNER, 'Day 1')).toBe(true);

  markAcademyPopupShown('u1', 'Day 1');
  expect(shouldShowAcademyPopup(LEARNER, 'Day 1')).toBe(false);
  expect(shouldShowAcademyPopup(LEARNER, 'Day 2')).toBe(true);

  markAcademyPopupShown('u1', 'Day 2');
  expect(shouldShowAcademyPopup(LEARNER, 'Day 2')).toBe(false);
  expect(shouldShowAcademyPopup(LEARNER, 'Day 3')).toBe(true);

  markAcademyPopupShown('u1', 'Day 3');
  expect(ACADEMY_POPUP_MAX_SHOWS).toBe(3);
  expect(shouldShowAcademyPopup(LEARNER, 'Day 4')).toBe(false);
});

test('opening Academy once suppresses future popups forever', () => {
  markAcademyOpened('u1');
  expect(shouldShowAcademyPopup(LEARNER, 'Day 1')).toBe(false);
  expect(shouldShowAcademyPopup(LEARNER, 'Day 2')).toBe(false);
});

test('guests, teachers, admins, and learners with completed calls never see the popup', () => {
  expect(shouldShowAcademyPopup({ uid: 'u2', isGuest: true, callCount: 0 }, 'Day 1')).toBe(false);
  expect(shouldShowAcademyPopup({ uid: null, isGuest: true, callCount: 0 }, 'Day 1')).toBe(false);
  expect(shouldShowAcademyPopup({ uid: 't1', role: 'teacher', callCount: 0 }, 'Day 1')).toBe(false);
  expect(shouldShowAcademyPopup({ uid: '6Djehd9KB8dTZUgVwVJfLoPI5dF3', callCount: 0 }, 'Day 1')).toBe(false);
  expect(shouldShowAcademyPopup({ uid: 'u3', role: 'student', callCount: 1 }, 'Day 1')).toBe(false);
});
