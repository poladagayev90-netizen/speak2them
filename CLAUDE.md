# SpeakLab (speak2them)

English speaking-practice app: React PWA + Firebase + Agora voice calls, wrapped as an Android APK with Capacitor. Business model: **3 free planned practices, then monthly packages of planned practice** — no popups or upsell screens; the packages page is reached only from Profile.

## Stack
- **Frontend**: React 19, CRA (`react-scripts`), PWA. `src/pages`, `src/components`, `src/utils`, `src/hooks`.
- **Backend**: Firebase Cloud Functions **v2** — almost everything in `functions/index.js` (~7,500 lines) plus small modules beside it (`pushTokens.js`, `practiceStats.js`, …). Native `fetch`, no AI SDKs.
- **Data**: Firestore (`firestore.rules` + `firestore.indexes.json`).
- **Voice**: Agora RTC. **AI**: Groq (Whisper STT + Llama), Deepgram (TTS), DeepSeek/Gemini (analysis).
- **Mobile**: Capacitor 8, package `com.speaklab.app`.

## ⚠️ Deploy safety — read before committing
- **`git push origin main` auto-deploys the web app to production** (Vercel). There is no staging. Treat a push as shipping to real users.
- **Default to showing the diff and asking before pushing**, unless the user explicitly says to deploy.
- Cloud Functions deploy separately and manually: `npx firebase-tools deploy --only functions --project speak2them-64f2b`.
- Functions live in **two regions**: **all six** Firestore triggers (`initTrialForNewUser`, `notifySearchingUser`, `reconcileCallStats`, `notifyChatMessage`, `notifyAdminOnboarding`, `syncUpcomingCall`) run in `europe-west4`; everything else `us-central1`.
- `CI=true` makes ESLint warnings fatal — a warning breaks the deploy. Verify with `CI=true npx react-scripts build` (Bash tool; PowerShell mangles the env prefix).
- Backend-only changes (`functions/`) do **not** require rebuilding the Android AAB.

## Skills (in `.claude/skills/`)
Load the matching one instead of re-deriving: `firebase-deploy`, `android-release`, `cloud-function-author`, `firestore-rules-guard`, `ai-pipeline`, `cost-optimizer`, `capacitor-expert`, `speaklab-content`, `verify`.

## Domain rules — read the file before touching its area
Each file holds the full rules, field names and the reasons behind them. Read it first; update it when the behaviour changes.

| Touching… | Read |
|---|---|
| Onboarding wizard, WhatsApp step, week grid (Free/Maybe/Never), «What happened?», `/intro`, first-run languages | `docs/domain/onboarding.md` |
| Packages, free practices, `accessState`, `billing.enforce`, `/packages` | `docs/domain/packages.md` |
| Pairing rules (`pairVerdict`), bookings, slot hours / 2-h windows, attendance, admin pair proposals (`matchOffers`) | `docs/domain/booking.md` |
| Weekly plan, refill, autopilot (`rosterMode`), account health, `directBook`, newcomers + hosts, AI planning analyst, roster, reliability, favourites | `docs/domain/planner.md` |
| Today / Plan / Partners, chat, Online now, Coming up, app updates, topic sheet on a computer | `docs/domain/app-screens.md` |
| Call screen: shared topic, minutes, incoming / missed call on Android, push payloads, in-call videos | `docs/domain/calls.md` |
| Individual lessons, Julian story, homework, `/lessons`, topic cycle, session schedule | `docs/domain/lessons.md` |
| Admin accounts, admin nav + Activity, Admin panel tabs and their layout rules | `docs/domain/admin.md` |
| Any UI styling: palette, tokens, type weights, icons | `docs/domain/design.md` |

## Invariants — these break silently
- **Firestore rules end in a catch-all deny** — a new collection without an explicit `match` is fully blocked. A rule that looks at the doc id cannot authorise a QUERY.
- Every pairing path goes through **`pairVerdict`**; the API never says which rule refused.
- **`users.upcomingCall` is derived** (`syncUpcomingCall`) — never write it directly.
- **Call ids are per PAIR** (`call_<a>_<b>`): server code creating a call overwrites, never merges. **Call minutes come from server timestamps** (`trustedCallSeconds`), never the client stopwatch.
- **Push payloads differ by platform** (`functions/pushTokens.js`): web = data-only, Android = `notification` block. A notification block on web doubles every notification.
- **Time is Baku (UTC+4, no DST)**; weekdays are **0 = Sunday**. Use `sessionSchedule.js` / `timezone.js` helpers — no hand-rolled time math. One session hour only (21:00); never re-add a daytime reminder.
- **Private data stays off `users`** (world-readable): age band, country, time zone, availability, WhatsApp live in `onboarding/{uid}`. The AI planning analyst sees aliases and numbers only.
- **Unlimited practice comes only from rules-protected fields** — never the client-writable `mode`. The package balance is never stored; it is derived from `bookings`.
- **Keep in step** (change both or neither): `SLOT_BLOCK_HOURS` ↔ `SLOT_START_HOURS`; `functions/availability.js` ↔ `src/utils/timezone.js`; `homeworkStepKeys` ↔ `functions/classBrief.js`; `functions/dailyQuestions.json` ↔ `src/data/weeklyContent.js` (same length); admin lists in rules (`isAdmin`) ↔ functions (`isAdminToken`) ↔ `src/constants.js` (`isAdminUser`); `appConfig/session.sessions` overrides the code defaults.
- **Lesson ids are storage keys** — add, never rename. `lessonProgress` is client-written, so it must never unlock anything.
- **CSS chunk order**: import `cohort.css` before `story.css`, and `ui.css` before `plan.css`, or the CI build fails.

## Conventions
- HTTP functions: `setCors(res, ...)` on every path, 204 short-circuit for `OPTIONS`, `verifyAuth(req)` for auth, and **`enforceRateLimit(...)` on every AI/paid endpoint**.
- **UI copy is English.** Exceptions: the analysis report (learner L1, az/tr) and the first run (az/tr/ru/en — new first-run copy is written four times; see `docs/domain/onboarding.md`). Keep `public/index.html` `lang="en"`.
- **Palette: Plum — one purple family.** No green, amber, teal or cyan. Red only for destructive controls and wrong answers; coral only for progress, never as text. Nothing glows. Use the tokens in `src/index.css` and the primitives in `src/components/ui/` — no raw px or colours. Icons from `lucide-react`, never emoji. Details: `docs/domain/design.md`.
- Match surrounding code style; the codebase uses explanatory comments for non-obvious decisions — keep that habit.
- Tests cover pure helpers only: `CI=true npx react-scripts test --watchAll=false` (web) and `node --test` in `functions/`. Behaviour is still verified by running the app (see the `verify` skill). The dev build talks to **production** Firebase; admin-only flows are verified on local emulators (`firebase.emu.json`, `scripts/emu-functions-server.js`, `REACT_APP_USE_EMULATORS` — see the `verify` skill).
- New feature rules go into the matching `docs/domain/*.md` file (or a new one listed in the table above) — not into this file. This file holds only what applies to every task.

## Project state docs
`APP_STORE_AUDIT.md` (Play Store blockers), `HANDOFF_REPORT.md` (architecture + tech debt), `STORE_LISTING.md`.

## Known open debt
- ~~`src/utils/analyzeWithOpenAI.js`~~ — the file no longer exists; the analysis is server-side. If those `REACT_APP_*` keys were ever real they are still in old build artifacts and should be rotated.
- Web SW notifications share a `tag` per type, so same-type notifications replace each other.
