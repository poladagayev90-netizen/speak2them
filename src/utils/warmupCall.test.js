import { showWarmupCard } from './warmupCall';

jest.mock('../firebase', () => ({ auth: {} }));

const user = { uid: 'u1', callCount: 0 };

test('a newcomer with no record sees the card', () => {
  expect(showWarmupCard({ user, record: null, config: null })).toBe(true);
  expect(showWarmupCard({ user, record: { attempts: 1 }, config: { enabled: true } })).toBe(true);
});

test('no card once a real call happened, the warm-up is done, or two tries are used', () => {
  expect(showWarmupCard({ user: { ...user, callCount: 1 }, record: null })).toBe(false);
  expect(showWarmupCard({ user, record: { completedAt: {} } })).toBe(false);
  expect(showWarmupCard({ user, record: { attempts: 2 } })).toBe(false);
});

test('no card while loading, when switched off, or for a teacher', () => {
  expect(showWarmupCard({ user, loading: true })).toBe(false);
  expect(showWarmupCard({ user, config: { enabled: false } })).toBe(false);
  expect(showWarmupCard({ user: { ...user, role: 'teacher' } })).toBe(false);
  expect(showWarmupCard({ user: null })).toBe(false);
});

test('an admin always sees it (testing), except when switched off', () => {
  const vet = { ...user, callCount: 40 };
  expect(showWarmupCard({ user: vet, record: { completedAt: {}, attempts: 9 }, admin: true })).toBe(true);
  expect(showWarmupCard({ user: vet, config: { enabled: false }, admin: true })).toBe(false);
});
