// All practice screens use the same Baku calendar and minute display.
export function timestampMs(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value?.seconds !== undefined) return Number(value.seconds) * 1000;
  if (typeof value === 'number') return value;
  return typeof value === 'string' ? (Date.parse(value) || 0) : 0;
}

export function latestPracticeMs(student) {
  return Math.max(timestampMs(student?.lastActiveAt), timestampMs(student?.lastAnalysisAt));
}

export function practiceWeekKey(value = new Date()) {
  const date = new Date(new Date(value).getTime() + 4 * 3600000);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function displayMinutes(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 10) / 10;
}

export function totalPracticeMinutes(student) {
  return displayMinutes((Number(student?.totalMinutes) || 0) + (Number(student?.aiPracticeSeconds) || 0) / 60);
}

export function weeklyPracticeMinutes(student, week = practiceWeekKey()) {
  const calls = student?.currentWeek === week ? Number(student.currentWeekMinutes) || 0 : 0;
  const ai = student?.aiPracticeWeek === week ? (Number(student.aiPracticeWeekSeconds) || 0) / 60 : 0;
  return displayMinutes(calls + ai);
}
