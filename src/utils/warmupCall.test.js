import { warmupOffer } from './warmupCall';

jest.mock('../firebase', () => ({ auth: {} }));

const user = { uid: 'u1', callCount: 0 };

test('a newcomer with no record gets the Today card', () => {
  expect(warmupOffer({ user, record: null, config: null })).toBe('card');
  expect(warmupOffer({ user, record: { attempts: 1 }, config: { enabled: true } })).toBe('card');
});

test('put aside («Not now» / straight to partners) → one row in Get ready, never both', () => {
  const later = { ...user, warmupDismissedAt: { seconds: 1 } };
  expect(warmupOffer({ user: later, record: null })).toBe('panel');
  expect(warmupOffer({ user: later, record: { attempts: 1 } })).toBe('panel');
});

test('nowhere once a real call happened, the warm-up is done, or two tries are used', () => {
  expect(warmupOffer({ user: { ...user, callCount: 1 }, record: null })).toBe(null);
  expect(warmupOffer({ user: { ...user, callCount: 1, warmupDismissedAt: {} }, record: null })).toBe(null);
  expect(warmupOffer({ user, record: { completedAt: {} } })).toBe(null);
  expect(warmupOffer({ user, record: { attempts: 2 } })).toBe(null);
});

test('nowhere while loading, when switched off, or for a teacher', () => {
  expect(warmupOffer({ user, loading: true })).toBe(null);
  expect(warmupOffer({ user, config: { enabled: false } })).toBe(null);
  expect(warmupOffer({ user: { ...user, role: 'teacher' } })).toBe(null);
  expect(warmupOffer({ user: null })).toBe(null);
});

test('an admin can always test it: card until «Not now», then the panel row', () => {
  const vet = { ...user, callCount: 40 };
  expect(warmupOffer({ user: vet, record: { completedAt: {}, attempts: 9 }, admin: true })).toBe('card');
  expect(warmupOffer({ user: { ...vet, warmupDismissedAt: {} }, record: { completedAt: {} }, admin: true })).toBe('panel');
  expect(warmupOffer({ user: vet, config: { enabled: false }, admin: true })).toBe(null);
});
