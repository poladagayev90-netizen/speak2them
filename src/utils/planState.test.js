import { planHeadline, openOffers, upcomingBookings, canJoin, peerOf } from './planState';

const now = Date.parse('2026-10-06T10:00:00+04:00');
const H = 3600000;
const ob = { weeklyTarget: 2, availability: [{ day: 1, startMin: 1080, endMin: 1320 }], charterAcceptedAt: { seconds: 1 } };
const booking = (startMs, over = {}) => ({ status: 'confirmed', startMs, participants: ['me', 'zed'], names: { me: 'Me', zed: 'Zed' }, levels: { zed: 'B1' }, ...over });
const offer = (startMs, over = {}) => ({ startMs, responses: { me: 'pending', zed: 'pending' }, ...over });
const base = { uid: 'me', bookings: [], offers: [], planStatus: null, onboarding: ob, attended: 0, weekKey: '2026-10-05', now };

test('no plan set up (no times, no target, or no charter) asks to set it up', () => {
  expect(planHeadline({ ...base, onboarding: null }).kind).toBe('setup');
  expect(planHeadline({ ...base, onboarding: { ...ob, availability: [] } }).kind).toBe('setup');
  expect(planHeadline({ ...base, onboarding: { ...ob, charterAcceptedAt: null } }).kind).toBe('setup');
});

test('the nearest booking wins, even over open proposals', () => {
  const h = planHeadline({ ...base, bookings: [booking(now + 50 * H), booking(now + 5 * H)], offers: [offer(now + 3 * H)] });
  expect(h.kind).toBe('next');
  expect(h.booking.startMs).toBe(now + 5 * H);
  expect(h.peerName).toBe('Zed');
  expect(h.joinable).toBe(false);
});

test('Join opens 5 minutes before and stays until the block ends', () => {
  const b = booking(now + 4 * 60000);
  expect(canJoin(b, now)).toBe(true);
  expect(canJoin(booking(now + 6 * 60000), now)).toBe(false);
  expect(canJoin(booking(now - 1.5 * H), now)).toBe(true);
  expect(upcomingBookings([booking(now - 2.5 * H)], now)).toHaveLength(0);
});

test('open proposals: mine not yet answered, not started, not past respondBy', () => {
  const list = [
    offer(now + 5 * H),
    offer(now + 6 * H, { responses: { me: 'accepted' } }),
    offer(now - H),
    offer(now + 7 * H, { respondBy: now - 1 }),
  ];
  expect(openOffers(list, 'me', now)).toHaveLength(1);
  expect(planHeadline({ ...base, offers: list })).toEqual({ kind: 'answer', count: 1 });
});

test('paused, goal reached, honest no-match, or waiting for the next plan', () => {
  expect(planHeadline({ ...base, onboarding: { ...ob, planPaused: true } }).kind).toBe('paused');
  expect(planHeadline({ ...base, attended: 2 }).kind).toBe('done');
  const nm = planHeadline({ ...base, planStatus: { state: 'no_match', reason: 'no_overlap', weekKey: '2026-10-05' } });
  expect(nm.kind).toBe('no_match');
  expect(nm.text).not.toMatch(/we will find|we'll find/i);
  // An old week's "no match" is not this week's news.
  expect(planHeadline({ ...base, planStatus: { state: 'no_match', reason: 'no_times', weekKey: '2026-09-28' } }).kind).toBe('waiting');
  expect(planHeadline(base).kind).toBe('waiting');
});

test('peerOf names the other person', () => {
  expect(peerOf(booking(now), 'zed')).toEqual({ peerUid: 'me', peerName: 'Me', peerLevel: null });
});
