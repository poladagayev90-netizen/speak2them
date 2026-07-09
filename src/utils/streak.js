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

// Visual/emotional tier for a given streak count. `effect` scales the celebration.
export function streakTier(count) {
  if (count >= 30) {
    return { key: 'legend', title: 'Əfsanə!', message: 'Aylıq streak! Sən dayanılmazsan! 👑', accent: '#a855f7', effect: 'crown' };
  }
  if (count >= 14) {
    return { key: 'diamond', title: 'Möhtəşəm!', message: 'İki həftə! Sən artıq peşəkarsan! 💎', accent: '#22d3ee', effect: 'crown' };
  }
  if (count >= 7) {
    return { key: 'fire', title: 'Sən əfsanəsən!', message: 'Bir həftəlik streak! 🔥', accent: '#f59e0b', effect: 'confetti' };
  }
  if (count >= 3) {
    return { key: 'hot', title: 'Əla gedirsən!', message: 'Alov böyüyür — davam et! 🔥', accent: '#f97316', effect: 'flame-lg' };
  }
  if (count >= 1) {
    return { key: 'spark', title: 'Yaxşı başladın!', message: 'İlk qığılcım yandı — sabah da qayıt!', accent: '#fb923c', effect: 'flame-sm' };
  }
  return { key: 'start', title: 'Başla!', message: 'Bu gün birinci addımı at! 🚀', accent: '#7c6ff7', effect: 'none' };
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
