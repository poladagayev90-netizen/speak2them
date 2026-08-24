// Streak model, derived entirely from the existing users/{uid}.streak (number)
// and lastCallDate (string, new Date().toDateString()). The increment logic
// lives in Chat.jsx and is untouched — this only interprets those fields.

export const MILESTONES = [3, 7, 14, 30, 60, 100];

// The stored `streak` is only corrected on the next call, so it goes stale when
// a day is missed. Compute the honest current state from lastCallDate.
export function getStreakInfo(user) {
  const streak = Number(user?.streak) || 0;
  const last = user?.lastCallDate || '';
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (last === today) return { count: streak, alive: true, doneToday: true };
  if (last === yesterday) return { count: streak, alive: true, doneToday: false };
  return { count: 0, alive: false, doneToday: false };
}

// Visual/emotional tier for a given streak count. `effect` scales the
// celebration; `accent` colours the flame halo, the trail and the milestone
// dots. The tiers used to climb a cyan-to-orange ladder, which put four hues
// the app does not own onto one screen. They are steps of the one purple now
// -- a token per tier rather than a literal, so each still inverts correctly
// between the light and dark room. The emoji is what carries the celebration;
// the colour only has to say "further along than yesterday".
export function streakTier(count) {
  if (count >= 30) {
    return { key: 'legend', title: 'Legend', message: 'A full month. Unstoppable.', accent: 'var(--act-vocab)', effect: 'crown' };
  }
  if (count >= 14) {
    return { key: 'diamond', title: 'Outstanding', message: 'Two weeks. You are in the habit now.', accent: 'var(--act-taboo)', effect: 'crown' };
  }
  if (count >= 7) {
    return { key: 'fire', title: 'You are a legend', message: 'A full week', accent: 'var(--ai)', effect: 'confetti' };
  }
  if (count >= 3) {
    return { key: 'hot', title: 'Going strong', message: 'The flame is growing — keep going', accent: 'var(--act-debate)', effect: 'flame-lg' };
  }
  if (count >= 1) {
    return { key: 'spark', title: 'Good start', message: 'First spark lit — come back tomorrow.', accent: 'var(--act-quiz)', effect: 'flame-sm' };
  }
  return { key: 'start', title: 'Begin', message: 'Take the first step today', accent: 'var(--accent)', effect: 'none' };
}

// The next milestone above `count`, and how many days remain to it.
export function nextMilestone(count) {
  const target = MILESTONES.find((m) => m > count);
  if (!target) return null;
  return { target, remaining: target - count };
}

export function isMilestone(day) {
  return MILESTONES.includes(day);
}
