import { planHeadline, openOffers, upcomingBookings, canJoin, peerOf, limitText, bookingDays, comingUpLabel, weekGoal } from './planState';

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

test('a reliability limit makes one practice the week\'s goal and explains the way back', () => {
  const limit = { active: true, target: 1, usualTarget: 3, missed: 2, recoverLeft: 2 };
  const h = planHeadline({ ...base, onboarding: { ...ob, weeklyTarget: 3 }, planStatus: { limit }, attended: 1 });
  expect(h).toEqual({ kind: 'done', attended: 1, target: 1 });
  const t = limitText(limit);
  expect(t.text).toContain('2 confirmed practices were missed');
  expect(t.text).toContain('next 2 practices');
  expect(t.text).toContain('back to 3 a week');
  expect(limitText({ ...limit, recoverLeft: 1, missed: 1 }).text).toContain('next practice and');
  expect(limitText(null)).toBeNull();
  expect(limitText({ active: false })).toBeNull();
});

test('no replacement found is said plainly', () => {
  const h = planHeadline({ ...base, planStatus: { state: 'no_match', reason: 'replacement_not_found', weekKey: '2026-10-05' } });
  expect(h.kind).toBe('no_match');
  expect(h.text).toContain('no other time has turned up');
});

test('the timeline groups bookings by calendar day and marks today', () => {
  const days = bookingDays([booking(now + 2 * H), booking(now + 3 * H), booking(now + 26 * H)], now);
  expect(days).toHaveLength(2);
  expect(days[0].items).toHaveLength(2);
  expect(days[0].isToday).toBe(true);
  expect(days[1].isToday).toBe(false);
  expect(bookingDays([], now)).toEqual([]);
});

test('coming-up label names today and tomorrow', () => {
  expect(comingUpLabel(now + 2 * H, now)).toMatch(/^Today, /);
  expect(comingUpLabel(now + 26 * H, now)).toMatch(/^Tomorrow, /);
});

test('autopilot: a learner who has not said «in» is asked, others are not', () => {
  const ob = { availability: [{ day: 1, startMin: 1200, endMin: 1320 }, { day: 3, startMin: 1200, endMin: 1320 }],
    weeklyTarget: 2, charterAcceptedAt: { seconds: Date.parse('2026-09-01T12:00:00+04:00') / 1000 } };
  const sat = Date.parse('2026-10-17T12:00:00+04:00');
  const base = { uid: 'me', bookings: [], offers: [], planStatus: null, onboarding: ob, weekKey: '2026-10-12', now: sat };
  expect(planHeadline({ ...base, autoMode: true })).toMatchObject({ kind: 'checkin', monday: '2026-10-19', next: true, days: [1, 3] });
  expect(planHeadline({ ...base, autoMode: false }).kind).toBe('waiting');
  const answered = { ...ob, weeks: { '2026-10-19': { days: [1] } } };
  expect(planHeadline({ ...base, onboarding: answered, autoMode: true }).kind).toBe('waiting');
});

test('in for this week on the autopilot: «looking», never «Sunday»; the goal follows the picked days', () => {
  const ob = { availability: [{ day: 3, startMin: 1200, endMin: 1320 }], weeklyTarget: 2,
    charterAcceptedAt: { seconds: Date.parse('2026-09-01T12:00:00+04:00') / 1000 },
    weeks: { '2026-10-12': { days: [3, 4, 5], hours: { 3: [20], 4: [20], 5: [19, 20] } } } };
  const wed = Date.parse('2026-10-14T09:00:00+04:00');
  const base = { uid: 'me', bookings: [], offers: [], planStatus: null, onboarding: ob, attended: 0, weekKey: '2026-10-12', now: wed };
  expect(planHeadline({ ...base, autoMode: true })).toMatchObject({ kind: 'looking', days: 'Wed, Thu, Fri' });
  expect(planHeadline({ ...base, autoMode: false }).kind).toBe('waiting');
  expect(planHeadline({ ...base, attended: 3, autoMode: true }).kind).toBe('done');
  expect(planHeadline({ ...base, attended: 2, autoMode: true }).kind).toBe('looking');
  expect(weekGoal({ onboarding: ob, weekKey: '2026-10-12' })).toBe(3);
  expect(weekGoal({ onboarding: ob, weekKey: '2026-10-19' })).toBe(2);
  expect(weekGoal({ onboarding: ob, weekKey: '2026-10-12', limitTarget: 1 })).toBe(1);
  const many = { ...ob, weeks: { '2026-10-12': { days: [1, 2, 3, 4, 5, 6] } } };
  expect(weekGoal({ onboarding: many, weekKey: '2026-10-12' })).toBe(4);
});
