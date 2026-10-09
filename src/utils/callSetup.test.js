import { callSetupSteps, callSetupBroken } from './callSetup';

test('no plugin, no steps', () => {
  expect(callSetupSteps(null)).toEqual([]);
  expect(callSetupBroken(null)).toBe(false);
});

test('a setting that is off breaks the ring; autostart only for its makers', () => {
  const ok = { notifications: true, callChannel: true, fullScreen: true, battery: true, manufacturer: 'google' };
  expect(callSetupBroken(ok)).toBe(false);
  expect(callSetupSteps(ok).map((s) => s.id)).not.toContain('autostart');
  expect(callSetupBroken({ ...ok, battery: false })).toBe(true);
  const xiaomi = callSetupSteps({ ...ok, manufacturer: 'Xiaomi' });
  expect(xiaomi.map((s) => s.id)).toContain('autostart');
  expect(callSetupBroken({ ...ok, manufacturer: 'xiaomi' })).toBe(false);
});
