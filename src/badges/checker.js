import { BADGE_DEFINITIONS, BADGE_ORDER } from './config';

export function checkNewBadges(userStats = {}, existingBadges = userStats.badges || []) {
  const earned = new Set(existingBadges || []);

  return BADGE_ORDER.filter((badgeId) => {
    if (earned.has(badgeId)) return false;
    const badge = BADGE_DEFINITIONS[badgeId];
    return Boolean(badge?.condition?.(userStats));
  });
}
