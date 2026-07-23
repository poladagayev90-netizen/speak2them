---
name: cost-optimizer
description: Reduce SpeakLab's LLM and Firebase costs — model selection, prompt/token efficiency, Whisper/audio, and Firestore read/write patterns. Use when writing or reviewing AI endpoints or Firestore access.
---

# Cost Optimizer (SpeakLab)

Apply when writing or modifying Cloud Functions, AI calls, or Firestore access. Pairs with `ai-pipeline` (which provider) and `cloud-function-author` (rate limiting).

## 1. Model selection
- Simple JSON generation, vocab extraction, basic grammar → **DeepSeek** or **Gemini 2.0 Flash**, never GPT-4o.
- GPT-4o only for reasoning smaller models genuinely fail at — and even then try `gpt-4o-mini` first.

## 2. Prompt / token efficiency
- Strip pleasantries from system prompts. Request strict JSON mode to avoid re-parse loops and wasted output tokens.
- Don't send the whole conversation when only the last few minutes matter — truncate or summarize before the LLM call.

## 3. Audio / Whisper
- Don't send silence to Whisper — do client-side VAD (in `Chat.jsx`) so only real speech is recorded/sent.
- Use compressed audio (webm/opus), never WAV, to cut bandwidth/egress.

## 4. Firestore reads/writes
- Avoid `onSnapshot` on large collections unless truly needed.
- Cache user profile + course topics in `localStorage`/`IndexedDB` to avoid repeat doc reads.
- The topic cycle deliberately stores no per-user progress (client computes it) — keep it that way; don't add per-user writes.

## 5. Rate limiting = cost ceiling
Every AI endpoint must call `enforceRateLimit` (per-user rolling window). It's the hard bound on what one account can spend — see `cloud-function-author`.
