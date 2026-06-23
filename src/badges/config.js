const rewardText = (reward) => {
  if (!reward) return '';
  if (reward.type === 'bonusMinutes') return `${reward.value} bonus minutes`;
  if (reward.type === 'unlockFeature') return `${reward.value} unlocked`;
  if (reward.type === 'discountPremium') return `${reward.value}% Pro discount`;
  if (reward.type === 'trialPremium') return `${reward.value} day Pro pass`;
  return '';
};

const badge = ({ id, label, description, conditionText, reward, condition }) => ({
  id,
  label,
  description,
  conditionText,
  reward,
  rewardText: rewardText(reward),
  condition,
});

export const BADGE_DEFINITIONS = {
  first_call: badge({
    id: 'first_call',
    label: 'First Words',
    description: 'Made your first call',
    conditionText: 'Complete 1 call',
    reward: { type: 'bonusMinutes', value: 10 },
    condition: (userData) => (userData.callCount || 0) >= 1,
  }),
  chatterbox: badge({
    id: 'chatterbox',
    label: 'Chatterbox',
    description: '10 calls completed',
    conditionText: 'Complete 10 calls',
    reward: { type: 'bonusMinutes', value: 30 },
    condition: (userData) => (userData.callCount || 0) >= 10,
  }),
  social_butterfly: badge({
    id: 'social_butterfly',
    label: 'Social Butterfly',
    description: '50 calls completed',
    conditionText: 'Complete 50 calls',
    reward: { type: 'discountPremium', value: 15 },
    condition: (userData) => (userData.callCount || 0) >= 50,
  }),
  beginner: badge({
    id: 'beginner',
    label: 'Getting Started',
    description: '60 minutes spoken',
    conditionText: 'Speak for 60 total minutes',
    reward: { type: 'bonusMinutes', value: 15 },
    condition: (userData) => (userData.totalMinutes || 0) >= 60,
  }),
  expert: badge({
    id: 'expert',
    label: 'Expert Speaker',
    description: '1000 minutes spoken',
    conditionText: 'Speak for 1000 total minutes',
    reward: { type: 'trialPremium', value: 3 },
    condition: (userData) => (userData.totalMinutes || 0) >= 1000,
  }),
  legend: badge({
    id: 'legend',
    label: 'L E G E N D',
    description: '5000 minutes spoken',
    conditionText: 'Speak for 5000 total minutes',
    reward: { type: 'discountPremium', value: 40 },
    condition: (userData) => (userData.totalMinutes || 0) >= 5000,
  }),
  week_warrior: badge({
    id: 'week_warrior',
    label: 'Week Warrior',
    description: '7-day streak',
    conditionText: 'Reach a 7-day streak',
    reward: { type: 'trialPremium', value: 1 },
    condition: (userData) => (userData.streak || 0) >= 7,
  }),
  monthly_master: badge({
    id: 'monthly_master',
    label: 'Monthly Master',
    description: '30-day streak',
    conditionText: 'Reach a 30-day streak',
    reward: { type: 'trialPremium', value: 7 },
    condition: (userData) => (userData.streak || 0) >= 30,
  }),
  well_rated: badge({
    id: 'well_rated',
    label: 'Well Rated',
    description: '4.5+ average rating',
    conditionText: 'Keep a 4.5+ average after 5 ratings',
    reward: { type: 'bonusMinutes', value: 10 },
    condition: (userData) => (userData.ratingCount || 0) >= 5 && (userData.rating || 0) / userData.ratingCount >= 4.5,
  }),
  night_owl: badge({
    id: 'night_owl',
    label: 'Night Owl',
    description: 'Made a call between 22:00-02:00',
    conditionText: 'Make a call between 22:00-02:00',
    reward: { type: 'bonusMinutes', value: 10 },
    condition: (userData, callData = {}) => {
      const hour = typeof callData.hour === 'number' ? callData.hour : new Date().getHours();
      return (hour >= 22 || hour < 2) && (userData.callCount || 0) >= 1;
    },
  }),
  marathon: badge({
    id: 'marathon',
    label: 'Marathon Speaker',
    description: 'Single call over 45 minutes',
    conditionText: 'Finish one 45+ minute call',
    reward: { type: 'bonusMinutes', value: 20 },
    condition: (_userData, callData = {}) => (callData.duration || 0) >= 2700,
  }),

  profile_pro: badge({
    id: 'profile_pro',
    label: 'Profile Pro',
    description: 'Filled bio and set level',
    conditionText: 'Add bio and level',
    reward: { type: 'bonusMinutes', value: 5 },
    condition: (userData) => Boolean(userData.bio && userData.level),
  }),
  century: badge({
    id: 'century',
    label: 'Century Club',
    description: '100 total calls completed',
    conditionText: 'Complete 100 calls',
    reward: { type: 'discountPremium', value: 30 },
    condition: (userData) => (userData.callCount || 0) >= 100,
  }),
  daily_devotee: badge({
    id: 'daily_devotee',
    label: 'Daily Devotee',
    description: '14-day streak',
    conditionText: 'Reach a 14-day streak',
    reward: { type: 'trialPremium', value: 3 },
    condition: (userData) => (userData.streak || 0) >= 14,
  }),
  speed_connector: badge({
    id: 'speed_connector',
    label: 'Speed Connector',
    description: 'Found a match in under 30 seconds',
    conditionText: 'Find a match in under 30 seconds',
    reward: { type: 'bonusMinutes', value: 5 },
    condition: (_userData, callData = {}) => (callData.matchTime || 999) <= 30,
  }),
  premium_curious: badge({
    id: 'premium_curious',
    label: 'Pro Curious',
    description: 'Visited the Pro page',
    conditionText: 'Visit the Pro page',
    reward: { type: 'discountPremium', value: 10 },
    condition: (userData) => userData.visitedPremium === true,
  }),
  five_star: badge({
    id: 'five_star',
    label: 'Five Star',
    description: 'Received a 5-star rating',
    conditionText: 'Receive a 5-star rating',
    reward: { type: 'bonusMinutes', value: 15 },
    condition: (userData) => userData.receivedFiveStar === true,
  }),
};

export const BADGE_ORDER = [
  'first_call',
  'chatterbox',
  'social_butterfly',
  'beginner',
  'expert',
  'legend',
  'week_warrior',
  'monthly_master',
  'well_rated',
  'night_owl',
  'marathon',
  'profile_pro',
  'century',
  'daily_devotee',
  'speed_connector',
  'premium_curious',
  'five_star',
];
