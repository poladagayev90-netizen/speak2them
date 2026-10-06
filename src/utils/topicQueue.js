import { bakuDateStr, bakuWeekday, getActiveDays } from './sessionSchedule';

// The topics that come after today's, with the Baku day each one starts.
// The global cycle (functions advanceCycle) moves one topic forward at 00:05
// Baku on every active day (sessionDays + bonusDays), so topic n+k arrives on
// the k-th active day after today. Pure — the clock and config are passed in.
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function upcomingTopics({ currentIndex, total, count = 6, config = null, nowMs = Date.now() }) {
  if (!total || !Number.isFinite(currentIndex)) return [];
  const days = getActiveDays(config);
  const out = [];
  if (days.size === 0) return out;
  const today = bakuDateStr(nowMs);
  // 60 days is far more than any schedule needs; it only stops a bad config
  // from looping forever.
  for (let i = 1; i <= 60 && out.length < Math.min(count, total - 1); i += 1) {
    const dateStr = bakuDateStr(nowMs + i * DAY_MS);
    if (!days.has(bakuWeekday(dateStr))) continue;
    out.push({
      index: (((currentIndex + out.length + 1) % total) + total) % total,
      dateStr,
      label: topicDayLabel(dateStr, today),
    });
  }
  return out;
}

// "Tomorrow", then "Thu 9 Oct".
export function topicDayLabel(dateStr, todayStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${WEEKDAYS[bakuWeekday(dateStr)]} ${d} ${MONTHS[m - 1]}`;
}
