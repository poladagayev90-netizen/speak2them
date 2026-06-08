export function getUserKey(user) {
  return user?.uid || user?.id || '';
}

export function dedupeUsers(users) {
  const map = new Map();
  users.forEach((user) => {
    const key = getUserKey(user);
    if (!key) return;
    const existing = map.get(key);
    const score = (user.totalMinutes || 0) * 1000 + (user.callCount || 0);
    const existingScore = (existing?.totalMinutes || 0) * 1000 + (existing?.callCount || 0);
    if (!existing || score >= existingScore) {
      map.set(key, { ...user, uid: key, id: key });
    }
  });
  return Array.from(map.values());
}

export function sortUsersForRanking(users) {
  return dedupeUsers(users).sort((a, b) => {
    const minutesDiff = (b.totalMinutes || 0) - (a.totalMinutes || 0);
    if (minutesDiff !== 0) return minutesDiff;

    const callsDiff = (b.callCount || 0) - (a.callCount || 0);
    if (callsDiff !== 0) return callsDiff;

    const streakDiff = (b.streak || 0) - (a.streak || 0);
    if (streakDiff !== 0) return streakDiff;

    const ratingA = a.ratingCount > 0 ? a.rating / a.ratingCount : 0;
    const ratingB = b.ratingCount > 0 ? b.rating / b.ratingCount : 0;
    const ratingDiff = ratingB - ratingA;
    if (ratingDiff !== 0) return ratingDiff;

    return (a.name || '').localeCompare(b.name || '');
  });
}

export function getUserRank(sortedUsers, currentUserId) {
  if (!currentUserId) return null;
  const index = sortedUsers.findIndex((user) => getUserKey(user) === currentUserId);
  return index === -1 ? null : index + 1;
}
