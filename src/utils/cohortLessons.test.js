import { topicsSinceJoin } from './cohortLessons';

test('the general course counts main days since the learner joined', () => {
  // Main days Mon/Wed/Fri + Sun. Joined Monday 2026-10-05; by Monday 2026-10-12
  // the cycle moved on Wed, Fri, Sun, Mon = 4 topics.
  const cfg = { sessionDays: [1, 3, 5], bonusDays: [0] };
  const user = { trialStartedAt: Date.parse('2026-10-05T10:00:00+04:00') };
  expect(topicsSinceJoin(user, cfg, 60, Date.parse('2026-10-12T12:00:00+04:00'))).toBe(4);
  expect(topicsSinceJoin({}, cfg, 60)).toBe(null);
  expect(topicsSinceJoin(user, cfg, 2, Date.parse('2026-10-12T12:00:00+04:00'))).toBe(2);
});
