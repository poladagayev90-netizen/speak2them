import { BADGE_DEFINITIONS } from './config';

export function describeBadgeRewards(badgeIds = []) {
  return badgeIds
    .map((badgeId) => BADGE_DEFINITIONS[badgeId]?.rewardText)
    .filter(Boolean);
}

export function applyBadgeRewardsToData(userData = {}, badgeIds = []) {
  const existingBadges = userData.badges || [];
  const nextBadges = [...existingBadges];
  const features = new Set(userData.featuresUnlocked || []);
  let bonusMinutes = userData.bonusMinutes || 0;
  let premiumDiscountPercent = userData.premiumDiscountPercent || 0;
  const rewardMessages = [];

  badgeIds.forEach((badgeId) => {
    if (nextBadges.includes(badgeId)) return;

    const badge = BADGE_DEFINITIONS[badgeId];
    if (!badge) return;

    nextBadges.push(badgeId);

    if (badge.reward?.bonusMinutes) {
      bonusMinutes += badge.reward.bonusMinutes;
    }

    if (badge.reward?.unlockFeature) {
      features.add(badge.reward.unlockFeature);
    }

    if (badge.reward?.discountPremium) {
      premiumDiscountPercent = Math.max(premiumDiscountPercent, badge.reward.discountPremium);
    }

    if (badge.rewardText) {
      rewardMessages.push(badge.rewardText);
    }
  });

  if (nextBadges.length === existingBadges.length) {
    return { updates: {}, rewardMessages: [] };
  }

  return {
    updates: {
      badges: nextBadges,
      bonusMinutes,
      featuresUnlocked: Array.from(features),
      premiumDiscountPercent,
    },
    rewardMessages,
  };
}
