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
  `button[type=submit]`), then on `/survey` click `text=Skip All — later` →
  lands on `/`. Use emails like `testverify.<x>.<ts>@example.com`, name
  `TestVerify<X>` so they're findable for cleanup.
- Fresh context ⇒ streak modal shows first (`.streak-btn-primary` Başla,
  `.streak-btn-secondary` opens journey with `.journey-close` X), then topic
  intro (`text=Ekrana Keç`), then the guided tour (`.guided-tour-next` to walk,
  `.guided-tour-skip`/`.guided-tour-close` to skip). Dismiss all before
  clicking Home buttons — their overlays intercept pointer events.

### Useful selectors
- Home: `#tour-find-partner`, `#tour-daily-topic`, `#tour-puzzle`, searcher
  banner `text=indi partnyor axtarır` + `text=Dərhal qoşul`.
- Call: `.call-roadmap` (+ `-start`, `-more`), `.daily-panel` / `.daily-close`,
  end call `.call-btn-big.end`, chat-page tour also uses `.guided-tour-next`.
- Post-call: insights shell has `text=Bitti ✓`; queued state says
  `Səs analiziniz növbəyə alındı`.
- Puzzle: keys `.puzzle-key:text-is("A")`, enter is `✓`, delete is `⌫`;
  AZ hint lock msg `.puzzle-hint-locked`.

### Matching two accounts
A clicks `#tour-find-partner`; B sees the searcher banner within ~1s and clicks
`Dərhal qoşul`; both auto-navigate to `/chat/**` and the call connects in a few
seconds (roadmap appears ⇒ call is live).

## Cleanup (test data lands in PROD)

Firestore user docs are admin-delete-only via rules, but the CLI runs as the
owner: get uids by querying `users` where `name >= 'TestVerify'` through the
Firestore REST API (sign in via identitytoolkit with the `.env` API key), then
`npx firebase-tools firestore:delete "users/<uid>" --force` (same for
`matchQueue/<uid>`, `calls/call_<uidA>_<uidB>` sorted pair). Auth accounts
can't be deleted from the CLI — orphans are harmless, but note them.

## Gotchas
- Functions logs: `npx firebase-tools functions:log --only <fn> -n 40`.
- `CI=true` makes ESLint warnings fatal — the deploy pipeline does the same.
- PowerShell mangles `CI=true` env prefix; use the Bash tool.
