---
name: capacitor-expert
description: Capacitor PWA→native (Android) audio/mic/WebView expertise for SpeakLab — microphone permissions, background audio throttling, Web Speech API fallbacks, and debugging. Use for mic/audio/WebView native issues.
---

# Capacitor Expert (SpeakLab PWA → Native)

For build/signing/release mechanics see the `android-release` skill; this skill is about **audio & WebView runtime behavior**.

## 1. Microphone permissions
- Android WebViews do NOT auto-prompt for mic. Request native permission via `@capacitor-community/speech-recognition` (or a voice-recorder plugin) **before** initializing Agora RTC or Web Speech API.
- `AndroidManifest.xml` must have `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` (present today).

## 2. Background audio
- Backgrounded WebViews throttle JS → Agora audio drops and Web Speech stops. Use `@capacitor/app` `appStateChange` listeners to manage the audio context; consider a foreground service only if background calls become a hard requirement.

## 3. Web Speech API fallbacks
- `window.SpeechRecognition` is unreliable in Android WebView. Always fall back to cloud STT (Groq Whisper — see `ai-pipeline`) when native recognition fails or returns empty.

## 4. Debugging audio
- Have the user check `adb logcat` for `Capacitor/Plugin` or `Chromium` tags about audio-context suspension.

## 5. Push in the WebView (context)
Web Notification/Push API is undefined in the Android WebView — that's why native push needed `@capacitor/push-notifications` + `google-services.json` + `POST_NOTIFICATIONS`. Payload differs by platform: Android needs a `notification` block, web stays data-only (see `functions/pushTokens.js` and the `play-store-release` memory).
