---
name: firebase-deploy
description: How to deploy SpeakLab — web (Vercel, push-to-main auto-deploy) vs Cloud Functions (manual firebase-tools, two regions), secrets, and the gotchas. Use whenever deploying, pushing, or shipping a change.
---

# Deploying SpeakLab

Two independent targets. Know which one your change touches.

## Web / frontend (Vercel)
- Project `speaklab` (`prj_5geskTYqMJSa0eWEY99tzRPAGHhE`), team `team_EjgDZouyFuCOg2mfLY9DfvGi`. No `.vercel/` dir in repo.
- **`git push origin main` auto-deploys to production** (GitHub integration). Production alias `https://speaklab-app.vercel.app` (`speak2them.vercel.app` 307-redirects there).
- `CI=true` in Vercel makes **any ESLint warning fatal**. Before pushing, run `CI=true npx react-scripts build` (Bash tool — PowerShell mangles the `CI=true` prefix). If it fails locally, it fails the deploy.
- Deploy authorization: pushing to main without asking each time is pre-approved.

## Cloud Functions (Firebase)
- Project `speak2them-64f2b`. Deploy manually:
  ```bash
  npx firebase-tools deploy --only functions:<name> --project speak2them-64f2b
  ```
- **Two regions — never assume one.** Firestore-trigger functions (`notifySearchingUser`, `initTrialForNewUser`) live in **europe-west4**; all HTTPS/scheduled functions are in **us-central1**. When reading `functions:list`, don't truncate the table.
- **Interactive login fails in this harness.** `firebase login` cannot run here (stdin is non-interactive). If a functions deploy needs auth, ask the user to run `firebase login` in a normal terminal first, then deploy.
- Secrets live in Firebase Secret Manager (`defineSecret` in `functions/index.js`): `AGORA_APP_CERTIFICATE`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `DEEPGRAM_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Set with `npx firebase-tools functions:secrets:set <NAME>`. Non-secret params (`AGORA_APP_ID`, `APP_URL`) use `defineString` with in-code defaults.

## Rules / indexes
`npx firebase-tools deploy --only firestore:rules` (and `firestore:indexes`). See the `firestore-rules-guard` skill before changing them.

## Verify after deploy
- Functions logs: `npx firebase-tools functions:log --only <fn> -n 40`.
- End-to-end app drive: the `verify` skill.
