---
name: cloud-function-author
description: Conventions for adding or editing a SpeakLab Cloud Function in functions/index.js — CORS, auth, secrets, rate limiting, regions, trial/cohort logic. Use before writing any new function or endpoint.
---

# Authoring SpeakLab Cloud Functions

All backend lives in one 2300-line `functions/index.js` (Firebase Functions **v2**, Node fetch, no OpenAI/Deepgram SDK). Match the house style below rather than inventing a new pattern.

## Anatomy of an HTTP endpoint
```js
exports.myFn = onRequest({ secrets: [GROQ_API_KEY], invoker: "public" }, async (req, res) => {
  setCors(res, "GET, POST");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  const decoded = await verifyAuth(req);          // throws "unauthorized"
  await enforceRateLimit(decoded.uid, "myFn", 20, 60_000);
  // ... work ...
});
```
- **`setCors(res, methods)`** on every response path + a 204 short-circuit for `OPTIONS`. It sends `Access-Control-Allow-Origin: *`.
- **`verifyAuth(req)`** reads the `Bearer` token and returns `verifyIdToken`. Admin-only? Check `decoded.uid === ADMIN_UID` (`6Djehd9KB8dTZUgVwVJfLoPI5dF3`).
- **`enforceRateLimit(uid, key, maxCalls, windowMs)`** — MANDATORY on every AI/paid endpoint. It's a per-user rolling window in the `rateLimits` collection (client-denied). Throws with `httpStatus:429`.
- Secrets via `defineSecret`; non-secret config via `defineString` with a default. Declare secrets in the `onRequest({ secrets: [...] })` list or they won't inject.

## Trigger & scheduled functions
- `onSchedule(...)`, `onDocumentCreated/Written(...)`. **These run in europe-west4**, HTTP/scheduled in us-central1 — see `firebase-deploy`. Deploy the exact function name.

## Domain rules you must not break
- **Trial gate** (`isTrialExpired`): trust only rules-protected fields (`isPremium`, `subscriptionPlan`, `cohortStatus`, `freeAccessUntil`) — NEVER the client-writable `mode`. `cohortStatus` pending/accepted and `isPremium` are exempt. `TRIAL_DAYS = 2`.
- **Topic cycle:** global monotonic `appConfig/cycle.currentTopicIndex`; `topicIndex = cycleTick % TOPIC_COUNT`. Progress is NOT stored per-user (client computes `currentCycleTick - startTick`). `TOPIC_COUNT` comes from `dailyQuestions.json` and must stay in sync with `src/data/weeklyContent.js`.
- **Baku time:** use `bakuDateStr()` / `bakuWeekday()` helpers (UTC+4, no DST) — don't use server local time.
- Session days default `[1,3,5]`, bonus `[0]`, overridable via `appConfig/session`.

## After editing
Deploy that one function (`firebase-deploy` skill), then `functions:log --only <fn>`. New collections/fields → update `firestore.rules` (`firestore-rules-guard` skill).
