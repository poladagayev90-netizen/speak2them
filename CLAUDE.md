# SpeakLab (speak2them)

English speaking-practice app: React PWA + Firebase + Agora voice calls, wrapped as an Android APK with Capacitor. Business model: **trial-open + cohort/course** — there are no Pro upsells, do not add any.

## Stack
- **Frontend**: React 19, CRA (`react-scripts`), PWA. `src/pages`, `src/components`, `src/utils`, `src/hooks`.
- **Backend**: Firebase Cloud Functions **v2** — everything in `functions/index.js` (~2300 lines) + `functions/pushTokens.js`. Native `fetch`, no AI SDKs.
- **Data**: Firestore (`firestore.rules` + `firestore.indexes.json`).
- **Voice**: Agora RTC. **AI**: Groq (Whisper STT + Llama), Deepgram (TTS), DeepSeek/Gemini (analysis).
- **Mobile**: Capacitor 8, package `com.speaklab.app`.

## ⚠️ Deploy safety — read before committing
- **`git push origin main` auto-deploys the web app to production** (Vercel). There is no staging. Treat a push as shipping to real users.
- **Default to showing the diff and asking before pushing**, unless the user explicitly says to deploy.
- Cloud Functions deploy separately and manually: `npx firebase-tools deploy --only functions --project speak2them-64f2b`.
- Functions live in **two regions**: Firestore triggers (`initTrialForNewUser`, `notifySearchingUser`) in `europe-west4`, everything else `us-central1`.
- `CI=true` makes ESLint warnings fatal — a warning breaks the deploy. Verify with `CI=true npx react-scripts build` (Bash tool; PowerShell mangles the env prefix).
- Backend-only changes (`functions/`) do **not** require rebuilding the Android AAB.

## Skills (in `.claude/skills/`)
Load the matching one instead of re-deriving: `firebase-deploy`, `android-release`, `cloud-function-author`, `firestore-rules-guard`, `ai-pipeline`, `cost-optimizer`, `capacitor-expert`, `speaklab-content`, `verify`.

## Core domain rules — don't break these
- **Trial gate** (`isTrialExpired`, functions/index.js): trust only rules-protected fields (`isPremium`, `subscriptionPlan`, `cohortStatus`, `freeAccessUntil`). NEVER trust the client-writable `mode`. Trial = 2 days.
- **Topic cycle**: global monotonic tick in `appConfig/cycle`; `topicIndex = cycleTick % TOPIC_COUNT`. Progress is **not** stored per user — the client computes `currentCycleTick - startTick`. `functions/dailyQuestions.json` and `src/data/weeklyContent.js` must stay the same length.
- **Session schedule**: `src/utils/sessionSchedule.js` + `appConfig/session`. Times are **Baku (UTC+4, no DST)** so every client computes the same window. **One session only: 21:00** (the 16:00 afternoon session was removed — never re-add a daytime reminder). 21:00 is a **recommended hour shown every day**; `sessionDays` Mon/Wed/Fri + `bonusDays` Sun only mark the **main** days (crowd + topic-cycle advance), they never gate practice — any user can search for a partner at any time. Weekdays are **0=Sunday…6=Saturday — Sunday is 0, not 7**. Use `getUpcomingSessionWindow()` (countdown) / `getSessionWindow()` / `getNextSessionDay()` — don't hand-roll time math. The Firestore doc's `sessions` array **overrides** the code defaults, so a config change needs both.
- **Call minutes are authoritative from call timestamps**, never the client stopwatch.
- **Firestore rules end in a catch-all deny** — a new collection without an explicit `match` is fully blocked.
- **Push payloads differ by platform** (`functions/pushTokens.js`): web = data-only + `Urgency: high` (the SW displays it); Android = `notification` block + `priority: high`. Adding a notification block to web causes duplicate notifications.

## Conventions
- HTTP functions: `setCors(res, ...)` on every path, 204 short-circuit for `OPTIONS`, `verifyAuth(req)` for auth, and **`enforceRateLimit(...)` on every AI/paid endpoint**.
- UI copy is **Azerbaijani**. Match surrounding code style; the codebase uses explanatory comments for non-obvious decisions — keep that habit.
- No test suite is wired up; verify changes by running the app (see the `verify` skill). There is no Firebase emulator setup — the dev build talks to **production** Firebase.

## Project state docs
`APP_STORE_AUDIT.md` (Play Store blockers), `HANDOFF_REPORT.md` (architecture + tech debt), `STORE_LISTING.md`.

## Known open debt
- `src/utils/analyzeWithOpenAI.js` calls AI APIs with `REACT_APP_*` keys that ship in the browser bundle — move server-side **and rotate the keys** (deleting the file is not enough).
- `testPush` (functions) is still **auth-less** — lock or remove before public release.
- Web SW notifications share a `tag` per type, so same-type notifications replace each other.
