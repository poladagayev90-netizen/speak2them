---
name: ai-pipeline
description: SpeakLab's AI stack — STT/LLM/TTS providers, which model for which job, and the post-call analysis flow. Use when touching AInur voice chat, call analysis, quiz generation, or any AI endpoint.
---

# SpeakLab AI pipeline

Providers are chosen per task on a cost/latency basis (see the `cost-optimizer` skill). Native `fetch` only — no OpenAI/Deepgram SDK in `functions/`.

## The stack
| Job | Provider / model | Why |
|---|---|---|
| Real-time STT (AInur voice bot) | **Groq** Whisper-large-v3-turbo | Groq LPU = ms-latency; live loop can't tolerate slow STT |
| Conversational LLM (AInur) | **Groq** Llama-3.1 | Fast enough for voice back-and-forth |
| TTS (AInur voice out) | **Deepgram** Aura (Asteria) | Real-time voice synthesis |
| Post-call grammar/vocab analysis | **DeepSeek** (or Gemini 2.0 Flash) | Best price/perf for structured JSON grammar analysis |
| Quiz generation | **Groq** (`generateQuiz`) | — |

Rejected: NVIDIA Parakeet ASR (latency too high for live), Firestore-trigger audio analysis (Storage cost — audio is assembled in RAM and posted directly, Storage cost ≈ 0).

## AInur flow (`chatWithAI`, us-central1, memory 1GiB)
`base64Audio` in → Groq Whisper (STT) → Groq Llama (LLM) → Deepgram Aura (TTS) → `audioBase64` out. Secrets: `GROQ_API_KEY`, `DEEPGRAM_API_KEY`.

## Post-call analysis flow
1. `src/utils/localRecorder.js` records mic to `.webm` (MediaRecorder).
2. On call end, transcript → LLM → grammar/vocab/score JSON → written to `callAnalysis`, shown in History and the home analysis modal.
3. Heavy analysis is queued: `analysisQueue` collection → `processAnalysisQueue` scheduled function drains it (avoids Groq rate-limit spikes when many calls end at once).

## ⚠️ Known debt — fix when you touch this
`src/utils/analyzeWithOpenAI.js` calls OpenAI/DeepSeek with **`REACT_APP_` keys that ship to the browser bundle** (deleting the file isn't enough — keys are already in built artifacts and must be rotated). Move this analysis fully server-side (a Cloud Function like `analyzeCallOpenAI`); frontend should send audio only. Rules for new/edited endpoints: `cloud-function-author` skill. Every AI endpoint MUST call `enforceRateLimit`.
