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
- Functions live in **two regions**: **all five** Firestore triggers (`initTrialForNewUser`, `notifySearchingUser`, `reconcileCallStats`, `notifyChatMessage`, `notifyAdminOnboarding`) run in `europe-west4`; everything else `us-central1`.
- `CI=true` makes ESLint warnings fatal — a warning breaks the deploy. Verify with `CI=true npx react-scripts build` (Bash tool; PowerShell mangles the env prefix).
- Backend-only changes (`functions/`) do **not** require rebuilding the Android AAB.

## Skills (in `.claude/skills/`)
Load the matching one instead of re-deriving: `firebase-deploy`, `android-release`, `cloud-function-author`, `firestore-rules-guard`, `ai-pipeline`, `cost-optimizer`, `capacitor-expert`, `speaklab-content`, `verify`.

## Core domain rules — don't break these
- **Onboarding** (`src/pages/Onboarding.jsx`, one question per slide): home `/` redirects to `/onboarding` while `users.onboardingVersion < ONBOARDING_VERSION` (`src/utils/onboarding.js`); bump the constant to re-ask everyone. Sensitive answers (age band, country, confirmed IANA `timeZone`, weekly `availability` in the learner's OWN time, `weeklyTarget`) live in `onboarding/{uid}` (owner + admin only) — never on the world-readable `users` doc. Availability ≠ commitment: the wizard caps `weeklyTarget` at the number of free days. Convert to Baku only at display time via `src/utils/timezone.js`. Admin reads it in Admin → Applicants (per-person local time, common free time, "who is free when" heatmap).
- **Trial gate** (`isTrialExpired`, functions/index.js): trust only rules-protected fields (`isPremium`, `subscriptionPlan`, `cohortStatus`, `freeAccessUntil`). NEVER trust the client-writable `mode`. Trial = 60 days (`TRIAL_DAYS`, mirrored in `src/utils/courseProgress.js`). Post-trial monetization is undecided — cohort course is the only paid path today. A minute balance (`availableTrialMinutes`, 100 at signup) is already DECREMENTED by `consumeTrialMinutes` but NOT enforced anywhere; enforcement is deliberately deferred to the payments phase. Note: on Play, selling digital minutes/credits generally has to go through Google Play Billing.
- **Intro call** (`/intro`, `src/utils/intro.js`): new learners book a 15-min call with the team right after onboarding. Required but NOT blocking — only random search and the slot board (Live) wait for `users.introDoneAt`, which is rules-protected and set only by `adminMarkIntro`. `needsIntro()` exempts anyone already practising (`callCount > 0`), anyone with a teacher, cohort members, teachers and the admin. `teamSlots` are admin-written and world-readable, so they hold NO learner identity; bookings live in `introBookings/{uid}`. Reminders ride on `practiceSlotTick`. Admin → Intros opens times and records outcomes.
- **Who may be paired** (`pairVerdict` in functions/index.js) — used by EVERY pairing path (slot board `joinSlotTx`, rematch in `leavePracticeSlot`, `bookPairTx`, `adminProposeMatch`, random search via `canPair`). Hard: a block either way, `users/{uid}/avoid/{peer}` ("don't pair me again") either way, minor (onboarding `ageBand: under18`) with adult, and — automatic pairing only — `partnerLevel: 'close'` with a CEFR gap > 1. Soft: a partner met in the last 7 days goes last. Random search asks `canPair` before `commitMatch` because the lists are private; the API never says which rule refused. Post-call behaviour tags go to admin-only `partnerFeedback`.
- **Attendance** (`attendance/{id}`, server-written only): `attended` (any held call >= 2 min, from `recordCallPractice`), `no_show` / `partner_no_show` / `unmatched` (decided at slot-block CLOSE, so late arrivals count), `late_cancel` (< 2 h before) / `cancelled` (from `leavePracticeSlot`, confirmed bookings only). `partner_no_show` and `unmatched` are the PLATFORM failing the learner — shown to the admin separately, never counted against them. Home "Your week" = onboarding `weeklyTarget` vs attended; Admin → Attendance flags learners for a conversation.
- **Admin pair proposals** (`matchOffers`, `adminProposeMatch` / `respondMatchOffer` / `adminCancelOffer`): a proposal is NOT a booking — only the second yes books it, through `bookPairTx` (the same core `teacherSetMatch` uses, so reminders/no-show/cancel keep working). Proposals use the 2-hour Baku slot blocks. One pending proposal per person. Who declined and why lives in admin-only `matchOfferNotes`; the other person is only told "this time did not work out", and only if they had already accepted.
- **Topic cycle**: global monotonic tick in `appConfig/cycle`; `topicIndex = cycleTick % TOPIC_COUNT`. Progress is **not** stored per user — the client computes `currentCycleTick - startTick`. `functions/dailyQuestions.json` and `src/data/weeklyContent.js` must stay the same length.
- **Session schedule**: `src/utils/sessionSchedule.js` + `appConfig/session`. Times are **Baku (UTC+4, no DST)** so every client computes the same window. **One session only: 21:00** (the 16:00 afternoon session was removed — never re-add a daytime reminder). 21:00 is a **recommended hour shown every day**; `sessionDays` Mon/Wed/Fri + `bonusDays` Sun only mark the **main** days (crowd + topic-cycle advance), they never gate practice — any user can search for a partner at any time. Weekdays are **0=Sunday…6=Saturday — Sunday is 0, not 7**. Use `getUpcomingSessionWindow()` (countdown) / `getSessionWindow()` / `getNextSessionDay()` — don't hand-roll time math. The Firestore doc's `sessions` array **overrides** the code defaults, so a config change needs both.
- **Call minutes are authoritative from call timestamps**, never the client stopwatch.
- **Firestore rules end in a catch-all deny** — a new collection without an explicit `match` is fully blocked.
- **Push payloads differ by platform** (`functions/pushTokens.js`): web = data-only + `Urgency: high` (the SW displays it); Android = `notification` block + `priority: high`. Adding a notification block to web causes duplicate notifications.

## Conventions
- HTTP functions: `setCors(res, ...)` on every path, 204 short-circuit for `OPTIONS`, `verifyAuth(req)` for auth, and **`enforceRateLimit(...)` on every AI/paid endpoint**.
- **UI copy is English.** The whole interface was moved to English and `i18next` removed (2026-08-21). The ONE exception is the analysis report, which stays in the learner L1 (`users.preferredLanguage`, az/tr) — see `src/utils/feedbackLanguage.js`. `public/index.html` is `lang="en"`; do not set it back to `az` without also reverting the copy, or `text-transform: uppercase` breaks Azerbaijani text.
- Use the design tokens in `src/index.css` (spacing `--s-*`, radius `--r-*`, type `--fs-*`, z `--z-*`) and the primitives in `src/components/ui/` — no raw px, no raw colours.
- **Palette: Plum — ONE purple family.** `--peer`/`--accent` (deep purple) = a real person, `--ai` (lighter purple) = AInur; the five in-call activities are further steps of the same band. **No green, amber, teal or cyan anywhere.** Red (`--danger-solid` + `--ink-on-danger`) is the only exception, reserved for destructive controls and wrong answers. There is no `data-palette` switch — it was removed with the recolour. Nothing glows: `--glass-lift` is the only shadow a surface gets, and there is no page-wide radial background.
- **`--ai` vs `--ai-fill`:** `--ai` is for text, icons and borders; a FILLED AInur control takes `--ai-fill` with `--text-on-ai`. Using `--ai` as a fill fails contrast in light mode.
- Small `--text-secondary`/`--text-muted` text at 11–13px is `font-weight: 600`; bottom-nav labels are 700.
- UI icons come from `lucide-react`, never emoji. Emoji are fine in CONTENT (a topic label), never as an icon.
- Match surrounding code style; the codebase uses explanatory comments for non-obvious decisions — keep that habit.
- No test suite is wired up; verify changes by running the app (see the `verify` skill). The dev build talks to **production** Firebase; admin-only flows are verified on local emulators (`firebase.emu.json`, `scripts/emu-functions-server.js`, `REACT_APP_USE_EMULATORS` — see the `verify` skill).

## Project state docs
`APP_STORE_AUDIT.md` (Play Store blockers), `HANDOFF_REPORT.md` (architecture + tech debt), `STORE_LISTING.md`.

## Known open debt
- ~~`src/utils/analyzeWithOpenAI.js`~~ — the file no longer exists; the analysis is server-side. If those `REACT_APP_*` keys were ever real they are still in old build artifacts and should be rotated.
- `testPush` (functions) is still **auth-less** — lock or remove before public release.
- Web SW notifications share a `tag` per type, so same-type notifications replace each other.
