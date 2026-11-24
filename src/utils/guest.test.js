import {
  GUEST_STORAGE_KEY,
  isGuestUser,
  readGuestFlag,
  setGuestFlag,
  buildGuestUser,
} from './guest';

beforeEach(() => {
  sessionStorage.clear();
});

test('guest flag toggles cleanly in sessionStorage', () => {
  expect(readGuestFlag()).toBe(false);
  setGuestFlag(true);
  expect(sessionStorage.getItem(GUEST_STORAGE_KEY)).toBe('1');
  expect(readGuestFlag()).toBe(true);
  setGuestFlag(false);
  expect(readGuestFlag()).toBe(false);
});

test('buildGuestUser builds a safe read-only guest profile with no uid', () => {
  const g = buildGuestUser();
  expect(isGuestUser(g)).toBe(true);
  expect(g.uid).toBeNull();
  expect(g.role).toBe('student');
  expect(isGuestUser({ uid: 'real-1' })).toBe(false);
  expect(isGuestUser(null)).toBe(false);
});
