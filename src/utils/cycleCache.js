// Lightweight cache of the server-driven global cycle's latest value. This
// module imports NOTHING (no firebase, no weeklyContent) so that weeklyContent
// can read it without an import cycle. cycle.js pushes updates here on each
// appConfig/cycle snapshot; weeklyContent.getTodayIndex() reads it.
let state = null; // { cycleTick, currentTopicIndex } | null

export function setCycleState(s) {
  state = s && Number.isFinite(s.currentTopicIndex) ? s : null;
}

export function getCachedCycle() {
  return state;
}
