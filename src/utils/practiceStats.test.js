import { latestPracticeMs, practiceWeekKey, totalPracticeMinutes, weeklyPracticeMinutes } from './practiceStats';
import { sortUsersForRanking } from './ranking';

test('new call activity wins over an older report date', () => {
  expect(latestPracticeMs({lastActiveAt: {seconds: 200}, lastAnalysisAt: {seconds: 100}})).toBe(200000);
  expect(latestPracticeMs({lastAnalysisAt: {seconds: 300}})).toBe(300000);
});
test('the week rolls over at Monday midnight in Baku on every device', () => {
  expect(practiceWeekKey('2026-09-06T19:59:59Z')).toBe('2026-08-31');
  expect(practiceWeekKey('2026-09-06T20:00:00Z')).toBe('2026-09-07');
});
test('combined practice includes AI without counting stale weekly minutes', () => {
  const u = {totalMinutes: 7, aiPracticeSeconds: 90, currentWeek:'2026-08-31', currentWeekMinutes:7, aiPracticeWeek:'2026-09-07', aiPracticeWeekSeconds:90};
  expect(totalPracticeMinutes(u)).toBe(8.5);
  expect(weeklyPracticeMinutes(u, '2026-09-07')).toBe(1.5);
  expect(totalPracticeMinutes({totalMinutes:35 / 60})).toBe(0.6);
});
test('AI-only learners are included in all-time ranking', () => {
  expect(sortUsersForRanking([{id:'call',totalMinutes:1},{id:'ai',aiPracticeSeconds:120}]).map(u=>u.id)).toEqual(['ai','call']);
});
