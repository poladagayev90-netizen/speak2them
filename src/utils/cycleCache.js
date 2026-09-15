// Lightweight cache of the server-driven global cycle's latest value. This
// module imports NOTHING (no firebase, no weeklyContent) so that weeklyContent
// can read it without an import cycle. cycle.js pushes updates here on each
// appConfig/cycle snapshot; weeklyContent.getTodayIndex() reads it.
let state = null;
try {
  const saved = localStorage.getItem('cached_cycle_state');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && Number.isFinite(parsed.currentTopicIndex)) {
      state = parsed;
    }
  }
} catch (e) {}

export function setCycleState(s) {
  state = s && Number.isFinite(s.currentTopicIndex) ? s : null;
  if (state) {
    try { localStorage.setItem('cached_cycle_state', JSON.stringify(state)); } catch (e) {}
  }
}

export function getCachedCycle() {
  return state;
}
