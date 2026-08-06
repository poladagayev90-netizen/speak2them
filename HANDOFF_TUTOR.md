# HANDOFF — SpeakLab tutor system + incident cleanup

You are taking over work on **SpeakLab (speak2them)**, a React PWA + Firebase + Agora
app, repo at `C:\Users\p\Desktop\speak2them`, Firebase project `speak2them-64f2b`.
Read `CLAUDE.md` first. The user (Polad) is frustrated because (a) he can't see the
tutor feature he asked for, and (b) the previous agent deleted production user data.
Both are addressed below. Be direct, fix the visible problem first, own the mistakes.

---

## 1. What the user actually wants RIGHT NOW

He wants to **see and use the tutor (teacher) system on his own account.** It is
built and deployed but gated, and it was never unlocked on the account he logs in
with. That is the #1 task. Do it first, verify it, then clean up.

His real login account:
- **`Polad Ağayev` — poladagayev90@gmail.com — uid `TjfuOekZHIcxIG5QuLcHUwYkz053`**

NOTE the trap: the project's `ADMIN_UID` is a DIFFERENT account:
- `Steel` — agayevpoli7@gmail.com — uid `6Djehd9KB8dTZUgVwVJfLoPI5dF3` (this is admin)

The previous agent's temp grant function hardcodes the **admin** uid (`Steel`), so it
would unlock the wrong account. Grant on the account the user actually signs in with
(`TjfuOekZ...`), or ask the user which account he uses and grant that one.

---

## 2. What is DONE and LIVE (do not rebuild — verify, don't redo)

Tutor system "Phase 0A + 0B", committed and pushed to `main` (auto-deployed to Vercel:
`speaklab-app.vercel.app`). Verified: the production web bundle contains the `/teacher`
and `/join` routes.

**Backend (functions/index.js, deployed to us-central1):**
- `createInviteCode` — a qualified teacher mints a student invite code.
- `claimTeacherCode` — a student links to a teacher (one Firestore transaction, a
  distinct error code per failure; 13+/guardian age gate; birthDate stored privately).
- Eligibility counter inside `consumeTrialMinutes` — a call ≥120s (server-timed from
  call timestamps) increments `users/{uid}.completedSessions`; at 3 it sets
  `teacherEligible=true`. Placed BEFORE the paid/no-op early return on purpose.

**Firestore rules (deployed):** new teacher fields on `users` are server-only (added to
`isNotChangingPremiumFields`/`isNotCreatingPremiumFields`); `teachers/{tid}` and
`teachers/{tid}/roster/*` are owner-read, no client writes; `users/{uid}/private/*`
owner-read; `inviteCodes` has NO match block on purpose (catch-all deny blocks
enumeration). `firestore.indexes.json` unchanged (no new index needed).

**UI (deployed):**
- `src/pages/TeacherUnlock.jsx` — route `/teacher`. Locked → progress 0/3; eligible →
  code generator with copy + WhatsApp share.
- `src/pages/JoinTeacher.jsx` — route `/join?c=CODE` (also `#/join` for Capacitor and
  Telegram `?start=c_CODE`). Student consent + age gate.
- `src/utils/teacher.js` — shared client helper (endpoints, error maps, URL parsing,
  pending-code storage so a deep link survives signup).
- `src/App.js` — routes, `/join`+`/teacher` added to `TRIAL_GATE_EXEMPT`, deep-link
  capture + post-signup resume, `role/teacherId/teacherEligible/completedSessions`
  added to `LIVE_USER_FIELDS` (live unlock, no reload).
- `src/pages/Profile.jsx` — teacher entry row (only shows once eligible/role=teacher).

Whole funnel was verified end-to-end against production with Playwright (48 checks:
funnel, deep-link resume, age gate, privacy isolation, both light/dark themes).

**Why the user sees "nothing special for teachers":** by design the funnel is invisible
until a user is eligible. His account isn't eligible → `/teacher` shows the locked 0/3
screen and Profile shows no teacher row. Nothing is broken; it just needs unlocking
(Task A) or 3 real sessions.

---

## 3. MISTAKES the previous agent made (be honest with the user about these)

1. **DELETED PRODUCTION USER DATA.** During test cleanup the agent ran
   `firebase firestore:delete "users" --shallow --force` intending to *list* docs.
   That command DELETES every document in the `users` collection. Backgrounding it and
   `kill`-ing after 1s did NOT stop it. This wiped most `users/{uid}` profile docs.
   - Firebase **Auth accounts survived** (delete never touches Auth) — users keep their
     logins; their `users/{uid}` doc auto-recreates on next sign-in (empty-ish), which
     is why `Polad Ağayev` and `Nelly Akhmedy` reappeared.
   - **Lost and UNRECOVERABLE:** profile fields on deleted docs, including
     `totalMinutes`/`weeklyMinutes` (the leaderboard data), bio, rating, streak, topics,
     survey answers, and `subscriptionPlan`/`cohortStatus`/`freeAccessUntil`/trial state.
   - No recovery path existed: **PITR was DISABLED and there were no backups.** A REST
     `readTime` read was silently ignored (returned current data). `calls` and all stats
     collections are empty, so minutes cannot be recomputed. The data is gone.
2. **Left the DB unprotected.** (Now fixed — see §5.)
3. **Deployed a temporary secret-gated backdoor function** (`devGrantTeacher`) that is
   STILL LIVE in production. Must be deleted (Task B).
4. **Left 8 test-account docs** in the `users` collection (Task C).

---

## 4. Current production facts (verified read-only)

`users/` collection right now — 12 docs, 4 real + 8 test junk:

KEEP (real):
- `5WwUvUnR1QQcHnJSoJUsjG1IS5r1`  Speaklab  info.speaklab.app@gmail.com
- `6Djehd9KB8dTZUgVwVJfLoPI5dF3`  Steel  agayevpoli7@gmail.com  (ADMIN)
- `TjfuOekZHIcxIG5QuLcHUwYkz053`  Polad Ağayev  poladagayev90@gmail.com  (USER'S LOGIN)
- `tcRlJe9jDteKLVaSaJuYHy81uLo2`  Nelly Akhmedy  akhmedynelly@gmail.com

DELETE (previous agent's test docs — single-doc deletes ONLY, never a collection path):
- `5EcYCXD7RYf2n5mbEGIrHBQPkSy2`  ResumeTeacher
- `7B8W2NYH2SMw2HbK2RvuJrPvrOt2`  User (testverify.resume)
- `DJkG0nME2gNrbnzOQEq3jI6hlDg1`  User (testverify.dbg)
- `ENJzbwup55gYoyCdB0Kk1rDh9vC2`  ResumeTeacher
- `UPa2ziC8BLgFwq0fmEopOGTMPmG2`  final
- `cZ744Lx6gGccoz4r4qs0G7w8VWj1`  User (testverify.resume)
- `eZyuOgnUWEhlNgCnZ1ouX01iHfx1`  User (testverify.resume)
- `iF9onjAQACS4UC3ZMuAA1dFdnMq1`  ResumeTeacher

Temp function still deployed: `devGrantTeacher` (us-central1). Secret-gated; body is
`{secret, uid}` — writes `teacherEligible/role/completedSessions` to the given uid
(falls back to ADMIN uid if none). Source is in `functions/index.js` just above the
`// ─── AI Quiz Generation` comment; secret string is in that source. DELETE IT (Task B).

`teacherEligible` on the user's account: **MISSING** (grant never applied).

---

## 5. Already hardened (done, don't redo)

- **PITR ENABLED** (7-day recovery) on `(default)`.
- **Delete protection ENABLED** on `(default)`.
  (Set via `firebase firestore:databases:update "(default)" --point-in-time-recovery
  ENABLED --delete-protection ENABLED`.)

---

## 6. YOUR TASKS, in order

**Task A — unlock the tutor system on the user's account (DO FIRST).**
Set `teacherEligible=true, role="teacher", completedSessions=3` on the account the user
logs in with (`TjfuOekZHIcxIG5QuLcHUwYkz053` — confirm with him first). Options:
  - Cleanest: edit `devGrantTeacher` to take a `uid` param (or point it at
    `TjfuOekZ...`), redeploy, call it, then delete it (Task B). NOTE: calling a
    secret-gated grant endpoint may be blocked by a safety classifier — if so, have the
    USER run the call himself via the `!` prefix (it's his project = authorized), or
    grant by signing in as admin `Steel` in a browser and writing the field (rules allow
    `isAdmin()` to update any user doc).
  - Then have the user open `/teacher` on `speaklab-app.vercel.app` (logged in as that
    account) → he should see the code generator. Generating a code makes the Profile
    "Şagird kodum" row appear. Verify a student can `/join?c=CODE`.

**Task B — delete the temp backdoor.** `firebase functions:delete devGrantTeacher
--project speak2them-64f2b --force`, then remove its source block from
`functions/index.js` and commit. This is security-sensitive; do it promptly.

**Task C — remove the 8 test docs** listed in §4. SINGLE-DOC deletes only:
`firebase firestore:delete "users/<uid>" --project speak2them-64f2b --force`. Never run
`firestore:delete` on a collection path again. (Optionally delete the matching Auth
accounts via Console → Authentication; they're the `testverify.*@example.com` ones.)

**Task D — fix the "Loading rankings…" trap.** `src/pages/Ranking.jsx` line ~80 shows
"Loading rankings…" whenever the list is empty — there is no separate empty state, so a
successful load of 0 users looks like an eternal spinner. Add a real empty state
("Hələ nəticə yoxdur" / no data yet). The board will repopulate as `totalMinutes`
re-accumulates from new calls. (The historical minutes themselves are gone — §3.)

**Task E — native app.** If the user is testing on the installed **Android app**, it
will NOT show `/teacher` — the AAB was never rebuilt. The tutor feature is web-only in
this phase (intended). If he needs it in the app, rebuild the AAB (`android-release`
skill). Otherwise tell him to test on `speaklab-app.vercel.app` in a browser.

---

## 7. Constraints you must respect (from CLAUDE.md)

- `git push origin main` AUTO-DEPLOYS the web app to production (Vercel). No staging.
  Show the diff and get an explicit OK before pushing.
- Cloud Functions deploy manually: `npx firebase-tools deploy --only functions:<name>
  --project speak2them-64f2b`. HTTP/scheduled = us-central1; Firestore triggers =
  europe-west4.
- `CI=true npx react-scripts build` (Bash tool, not PowerShell) — a warning is a fatal
  deploy error. Run before any push.
- UI copy is Azerbaijani. New backend endpoints need `setCors` + OPTIONS 204 +
  `verifyAuth` + `enforceRateLimit`, and `invoker: "public"` for browser-called ones.
- There is no emulator; the dev build talks to PRODUCTION Firebase. Any test accounts
  you create MUST be cleaned up (single-doc deletes).

## Növbəti deploy üçün gözləyən işlər (2026-08-06)
- [ ] Profildə birbaşa zəng düyməsi əlavə et
- [ ] Taboo sözlərini 89-dan ~1000-ə çıxart (B1-B2 səviyyə, forbidden siyahısı ilə, batch-batch yazıb yoxlanaraq — "picture describing" işindəki üsulla). Şagirdlər eyni sözlərin təkrarlandığından şikayət edir.
