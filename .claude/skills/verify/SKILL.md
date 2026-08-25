---
name: verify
description: Build, serve, and drive the real SpeakLab app headlessly (Playwright) against production Firebase — register test accounts, match two users, make a real call, then clean up. Use to verify a change end-to-end in the actual app.
---

# Verify: speak2them (CRA + Firebase + Agora)

Build, serve, and drive the real app headlessly against production Firebase.

## Build & serve

```bash
CI=true npx react-scripts build          # from repo root (Git Bash)
npx serve -s build -l 3399               # run_in_background
```

`.env` in the repo root supplies the Firebase config — the build talks to the
**production** project (speak2them-64f2b). There is no emulator setup.

## Drive with Playwright

Install `playwright` in the scratchpad (`npm init -y && npm i playwright --no-save`,
`npx playwright install chromium`). Launch Chromium with
`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` and context
`permissions: ['microphone']` — real Agora voice calls then connect between two
browser contexts.

### Account flow
- Register throwaway accounts at `/register` (name/email/password inputs,
  `button[type=submit]`), then on `/survey` click the skip control (`text=/skip/i`) →
  lands on `/`. Use emails like `testverify.<x>.<ts>@example.com`, name
  `TestVerify<X>` so they're findable for cleanup.
- Fresh context ⇒ streak modal shows first (`.streak-btn-primary` Start,
  `.streak-btn-secondary` opens journey with `.journey-close` X), then topic
  intro (`text=Open`), then the guided tour (`.guided-tour-next` to walk,
  `.guided-tour-skip`/`.guided-tour-close` to skip). Dismiss all before
  clicking Home buttons — their overlays intercept pointer events.

### Useful selectors
- **/live** (NOT Home — search moved there in the Home/Live split): `#tour-find-partner`, searcher
  banner `text=is looking for a partner` + `text=Join now`.
- Call: `.call-roadmap` (+ `-start`, `-more`), `.daily-panel` / `.daily-close`,
  end call `.call-btn-big.end`, chat-page tour also uses `.guided-tour-next`.
- Post-call: insights shell has `text=Thank you ✓`; queued state says
  `Your speaking analysis is queued`.
- Puzzle: keys `.puzzle-key:text-is("A")`, enter is `✓`, delete is `⌫`;
  hint lock msg `.puzzle-hint-locked`.

### Matching two accounts
Send BOTH pages to `/live` first. A clicks `#tour-find-partner`; B sees the
searcher banner within ~1s and clicks
`Join now`; both auto-navigate to `/chat/**` and the call connects in a few
seconds (roadmap appears ⇒ call is live).

## Cleanup (test data lands in PROD)

**Use the app's own deletion endpoint — it works, and it removes the Auth
account too.** Two earlier sessions gave up here and left orphans behind
because they reached for `firebase-tools firestore:delete`, which the
permission classifier blocks and which cannot touch Auth anyway.

Sign each throwaway account in with the password the test used, then POST its
own idToken to `deleteAccount`:

```js
const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }) });
const { idToken } = await r.json();
await fetch('https://us-central1-speak2them-64f2b.cloudfunctions.net/deleteAccount',
  { method: 'POST', headers: { 'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}` }, body: '{}' });   // -> {"ok":true}
```

`KEY` is `REACT_APP_FIREBASE_API_KEY` from `.env`. The function wipes the user
doc and its subcollections, `wordHistory`, `matchQueue`, `premiumRequests`,
teacher rosters and storage, anonymises shared call/chat records, and finally
calls `admin.auth().deleteUser`. Nothing is left over.

So: **log the exact emails the run created** and delete them at the end of the
same session. Querying `users` by `name >= 'TestVerify'` misses any run that
used realistic display names — the email is the reliable handle.

## Gotchas
- Functions logs: `npx firebase-tools functions:log --only <fn> -n 40`.
- `CI=true` makes ESLint warnings fatal — the deploy pipeline does the same.
- PowerShell mangles `CI=true` env prefix; use the Bash tool.


## AInur activity (added 2026-08-21)

`/practice` is a full-screen AInur session (it covers the tab bar). Selectors:
`.ai-mic` (tap to start, tap again to stop), `.ai-mic-label` (state/timer),
`.ui-pill--hit` (a keyword the learner actually said), `.ai-heard` (transcript
receipt), `.ai-bubble-text` (AInur's reply), `text=/Finish/i` to end and grade.

**Playwright needs real speech, not the default tone.** The fake device plays a
sine wave, Whisper returns nothing, and the turn takes the `silent` branch — so
the test passes while proving nothing. Generate a WAV with Windows SAPI and pass
`--use-file-for-fake-audio-capture=<wav>`:

```powershell
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, 16, 1)
$s.SetOutputToWaveFile("speech.wav", $fmt); $s.Speak("..."); $s.Dispose()
```

A session needs ~60 spoken words before `analyzeAiSession` writes a report;
below that it returns `{ok:false, reason:"too-short"}` by design. The result is
a normal `callAnalysis` document, so it shows up on `/history` like any call.
