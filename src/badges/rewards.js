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
  let trialPremiumDays = userData.trialPremiumDays || 0;
  const rewardMessages = [];

  badgeIds.forEach((badgeId) => {
    if (nextBadges.includes(badgeId)) return;

    const badge = BADGE_DEFINITIONS[badgeId];
    if (!badge) return;

    nextBadges.push(badgeId);

    const reward = badge.reward || {};
    const rewardType = reward.type;
    const rewardValue = reward.value;

    if (reward.bonusMinutes || rewardType === 'bonusMinutes') {
      bonusMinutes += reward.bonusMinutes || rewardValue || 0;
    }

    if (reward.unlockFeature || rewardType === 'unlockFeature') {
      features.add(reward.unlockFeature || rewardValue);
    }

    if (reward.discountPremium || rewardType === 'discountPremium') {
      premiumDiscountPercent = Math.max(premiumDiscountPercent, reward.discountPremium || rewardValue || 0);
    }

    if (rewardType === 'trialPremium') {
      trialPremiumDays += rewardValue || 0;
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
      trialPremiumDays,
    },
    rewardMessages,
  };
}
