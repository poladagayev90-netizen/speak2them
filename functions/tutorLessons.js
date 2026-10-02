// Individual lessons (Preply / Google Meet): each student has their own
// timetable, so every lesson is stored with its own date — a lesson can be
// moved or cancelled without touching the others. This module is the pure
// part of teacherLesson: turning a weekly pattern into dates, suggesting the
// next topics and numbering the held lessons. Times are entered in Baku time
// (UTC+4, no DST), the teacher's clock; learners see them in their own.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PLAN = 30;

const pad = (n) => String(n).padStart(2, "0");
const bakuDateStr = (ms) => new Date(ms + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
const weekday = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

// "19:00" → minutes after midnight, or null.
function parseTime(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || ""));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

// The Baku wall-clock "YYYY-MM-DD" + "HH:MM" as epoch ms, or null.
function bakuMs(dateStr, time) {
  const min = parseTime(time);
  if (min === null || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;
  const ms = Date.parse(`${dateStr}T${pad(Math.floor(min / 60))}:${pad(min % 60)}:00+04:00`);
  return Number.isFinite(ms) ? ms : null;
}

// `count` lessons on the given Baku weekdays (0 = Sunday) at `time`, from the
// date `from` on. Lessons already past `notBeforeMs` are skipped, so planning
// "from today" never creates a lesson that has already started.
function weeklyDates({ days, time, from, count, notBeforeMs = 0 }) {
  const set = new Set((Array.isArray(days) ? days : []).map(Number).filter((d) => d >= 0 && d <= 6));
  const n = Math.min(MAX_PLAN, Math.max(0, Math.floor(Number(count) || 0)));
  const first = bakuMs(from, "12:00");
  if (set.size === 0 || n === 0 || first === null || parseTime(time) === null) return [];
  const out = [];
  for (let ms = first, i = 0; out.length < n && i <= n * 7 + 7; i++, ms += DAY_MS) {
    const dateStr = bakuDateStr(ms);
    if (!set.has(weekday(dateStr))) continue;
    const at = bakuMs(dateStr, time);
    if (at > notBeforeMs) out.push(at);
  }
  return out;
}

// The next `count` topics in course order after the student's latest one, so a
// new lesson always has materials to prepare; the teacher can change any of
// them. Topics already used by this student are skipped while unused ones remain.
function suggestTopics(usedInOrder, count, total) {
  const used = new Set(usedInOrder.filter((t) => Number.isInteger(t)));
  const last = [...usedInOrder].reverse().find((t) => Number.isInteger(t));
  let cur = Number.isInteger(last) ? last : -1;
  const out = [];
  for (let guard = 0; out.length < count && guard < total * 2; guard++) {
    cur = (cur + 1) % total;
    if (used.size >= total || !used.has(cur)) {
      out.push(cur);
      used.add(cur);
    }
  }
  return out;
}

const atMs = (l) => (l.at && typeof l.at.toMillis === "function" ? l.at.toMillis() : Number(l.at) || 0);

// Held lessons numbered 1, 2, 3 … by date. A cancelled or planned lesson never
// takes a number, and a lesson marked held late (the teacher forgot) still
// lands in its place. The number is also the story episode the student reads
// before that lesson.
function numberHeld(lessons) {
  const held = lessons.filter((l) => l.status === "held").sort((a, b) => atMs(a) - atMs(b) || String(a.id).localeCompare(String(b.id)));
  return new Map(held.map((l, i) => [l.id, i + 1]));
}

// Two pushes before each planned lesson: "prepare" about three hours ahead
// (the topic sheet and the Julian episode are waiting on /class/:id) and
// "soon" fifteen minutes ahead. Each is remembered on the lesson as the start
// time it was sent for (`reminded.prepare` / `reminded.soon`), so a moved
// lesson is reminded again for its new time and a tick that runs twice never
// sends twice. A lesson created or moved inside the window gets the reminder
// it is due right away — never one whose time has passed.
const PREPARE_MS = 3 * 60 * 60 * 1000;
const SOON_MS = 15 * 60 * 1000;

function reminderDue(lesson, nowMs) {
  if (!lesson || lesson.status !== "planned") return null;
  const at = atMs(lesson);
  const left = at - nowMs;
  if (left <= 0 || left > PREPARE_MS) return null;
  const sent = lesson.reminded || {};
  if (left <= SOON_MS) return sent.soon === at ? null : "soon";
  return sent.prepare === at ? null : "prepare";
}

module.exports = { DAY_MS, MAX_PLAN, PREPARE_MS, SOON_MS, parseTime, bakuMs, weeklyDates, suggestTopics, numberHeld, atMs, reminderDue };
