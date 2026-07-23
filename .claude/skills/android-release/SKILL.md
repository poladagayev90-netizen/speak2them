---
name: android-release
description: Build a signed SpeakLab Android AAB/APK with Capacitor — sync, keystore signing, versionCode, and the keyboard/safe-area and encoding traps. Use for any Android build, APK, AAB, Play Store, or Capacitor task.
---

# SpeakLab Android release (com.speaklab.app)

Capacitor 8.4.1 · minSdk 24 · target/compileSdk 36 · needs **JDK 21**. Full Play blocker history: `APP_STORE_AUDIT.md`.

## Build order (do not skip step 1)
```bash
npm run build && npx cap sync android      # ALWAYS first — else AAB ships stale web
cd android && ./gradlew bundleRelease      # → app/build/outputs/bundle/release/app-release.aab
```
Skipping `npm run build && cap sync` leaves `android/app/src/main/assets/public` stale, so the AAB carries an old web app.

## Signing (already set up)
- Keystore `android/app/speaklab-release.jks`, alias `speaklab-key`, `CN=Polad Agayev, OU=SpeakLab, C=AZ`.
- Passwords come from **git-ignored `android/app/gradle.properties`** (`MYAPP_RELEASE_STORE_PASSWORD` / `_KEY_ALIAS` / `_KEY_PASSWORD`), loaded explicitly in `android/app/build.gradle` (Gradle doesn't auto-load module-level gradle.properties). Missing keys → unsigned fallback.
- Keep both `enableV1Signing` and v2: minSdk 24 drops v1, but sideloaded APKs need v1 to install directly. Play re-signs anyway.
- Root `android/gradle.properties` is tracked — don't touch it.

## versionCode — bump EVERY upload
`android/app/build.gradle`: `versionCode` / `versionName`. First upload can be `1`; every subsequent Play upload MUST increment `versionCode` or it's rejected.

## Non-obvious traps
- **Keyboard blank-gap:** the IME inset was applied twice (Capacitor core SystemBars + @capacitor-community/safe-area). Fix in `capacitor.config.ts`: `SystemBars.insetsHandling:'disable'` + `Keyboard.resize:'none'` — safe-area plugin becomes sole IME owner. Do not set Keyboard resize to `native`.
- **`android/local.properties` encoding:** never write it with PowerShell `echo`/`Out-File` (PS 5.1 defaults to UTF-16 BOM; Gradle reads ISO-8859-1 → "SDK location not found"). Delete the file, then write raw ASCII via bash heredoc: `sdk.dir=C:/Users/p/AppData/Local/Android/Sdk`.
- **`public/ig/` excluded from APK** via `ignoreAssetsPattern` `!ig` (marketing assets grew it 8.8→13.2 MB; Vercel still serves them).
- Native push needs `android/app/google-services.json` (committed) — without it the google-services plugin silently no-ops and push dies.

## Play Console essentials
Privacy `https://speaklab-app.vercel.app/privacy.html`, deletion `.../delete-account.html`. App access MUST include an **email/password** test account (Google sign-in is hidden natively — `Login.jsx`). Internal testing → accept Play App Signing → Production. Details in `play-store-release` memory.
