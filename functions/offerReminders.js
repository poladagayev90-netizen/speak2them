// One reminder per person for a practice proposal they have not answered.
//
// Plan offers close at `respondBy` (sendWeeklyPlan: up to 48 h; a refill: 6 h).
// In the week of 2026-10-05 every plan offer ran out unanswered — nobody had
// been nudged once after the Sunday push. Halfway through the answer time (at
// most 12 h after it was sent) whoever has not answered gets ONE reminder.
// The claim lives on the offer (`reminded.{uid}`) so a tick that runs twice
// never sends it twice.

const HOUR_MS = 60 * 60 * 1000;
const REMIND_AFTER_MS = 12 * HOUR_MS;
// Not worth a push when the practice itself is about to start.
const MIN_LEAD_MS = 2 * HOUR_MS;

const msOf = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : Number(v) || 0);

// When the reminder for this offer is due (ms), or null if it never is.
function reminderAtMs(offer) {
  const created = msOf(offer.createdAt);
  const respondBy = Number(offer.respondBy) || 0;
  if (!created || !respondBy || respondBy <= created) return null;
  return created + Math.min(REMIND_AFTER_MS, (respondBy - created) / 2);
}

// Who should be reminded now. Pure — the caller claims and sends.
function offerReminderTargets(offer, nowMs) {
  if (!offer || offer.status !== "pending") return [];
  const at = reminderAtMs(offer);
  if (at === null || nowMs < at) return [];
  if (nowMs >= Number(offer.respondBy)) return [];
  if (Number(offer.startMs) - nowMs < MIN_LEAD_MS) return [];
  const responses = offer.responses || {};
  const reminded = offer.reminded || {};
  return (offer.participants || []).filter((u) => u && responses[u] !== "accepted" && !reminded[u]);
}

module.exports = { offerReminderTargets, reminderAtMs, REMIND_AFTER_MS };
