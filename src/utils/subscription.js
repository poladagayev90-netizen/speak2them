// Subscription / trial model, shared by Home, Chat, Admin and Profile.

export const TRIAL_MINUTES = 100;

export const PLAN = {
  FREE: 'free',
  TRIAL: 'trial',
  BASIC: 'basic',
  PRO: 'pro',
  UNLIMITED: 'unlimited',
};

// Plans whose call time is drawn from the trial + bonus balance. Paid plans
// (basic/pro/unlimited) run on their own monthly/unlimited allowance and are
// not gated by trial minutes.
export function isMetered(plan) {
  return plan === PLAN.FREE || plan === PLAN.TRIAL || !plan;
}

// The call minutes a user has left = trial allowance + earned bonus.
export function remainingMinutes(user) {
  if (!user) return 0;
  const trial = Number(user.availableTrialMinutes) || 0;
  const bonus = Number(user.bonusMinutes) || 0;
  return Math.max(0, trial + bonus);
}
