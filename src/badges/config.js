export const BADGE_DEFINITIONS = {
  first_call: {
    id: 'first_call',
    label: 'First Call',
    description: 'Complete your first real call.',
    conditionText: '1 call tamamla',
    rewardText: '10 bonus dəqiqə',
    reward: { bonusMinutes: 10 },
    condition: (stats) => (stats.callCount || 0) >= 1,
  },
  ten_minutes: {
    id: 'ten_minutes',
    label: '10 Minutes',
    description: 'Speak for 10 total minutes.',
    conditionText: 'Cəmi 10 dəqiqə danış',
    rewardText: 'Priority match açılır',
    reward: { unlockFeature: 'priority_match' },
    condition: (stats) => (stats.totalMinutes || 0) >= 10,
  },
  streak_3: {
    id: 'streak_3',
    label: '3 Day Streak',
    description: 'Practice for 3 days in a row.',
    conditionText: '3 gün ardıcıl danış',
    rewardText: '20% premium endirim',
    reward: { discountPremium: 20 },
    condition: (stats) => (stats.streak || 0) >= 3,
  },
  ten_calls: {
    id: 'ten_calls',
    label: '10 Calls',
    description: 'Complete 10 calls.',
    conditionText: '10 zəng tamamla',
    rewardText: '30 bonus dəqiqə',
    reward: { bonusMinutes: 30 },
    condition: (stats) => (stats.callCount || 0) >= 10,
  },
  explorer: {
    id: 'explorer',
    label: 'Explorer',
    description: 'Open the upgrade page.',
    conditionText: 'Upgrade səhifəsinə daxil ol',
    rewardText: '10% premium endirim və upgrade shortcut',
    reward: { discountPremium: 10, unlockFeature: 'upgrade_shortcut' },
    condition: (stats) => stats.hasVisitedPremium === true,
  },
};

export const BADGE_ORDER = ['first_call', 'ten_minutes', 'streak_3', 'ten_calls', 'explorer'];
