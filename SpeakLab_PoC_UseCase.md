# SpeakLab Proof of Concept (PoC) & Use Case

### 1. One-Line Pitch
SpeakLab is an interactive, hybrid (AI + Peer) language platform that transforms traditional language courses into a real-time, 28-topic speaking journey for EFL learners worldwide.

### 2. The Use Case
- **WHO:** A2-B1 level EFL (English as a Foreign Language) learners in non-English speaking countries. At this level, learners know the theory but suffer from the "intermediate plateau"—they are too afraid to speak to native speakers or strangers without structure.
- **PROBLEM:** Traditional courses offer no live practice, while random chat apps are too chaotic and intimidating for A2 learners who need structured, guided topics to overcome their speaking anxiety.
- **HOW SpeakLab SOLVES IT:** SpeakLab offers a structured 28-topic course roadmap. For each topic, the user follows a 3-step loop: 
  1. **Learn:** Review the theory/vocabulary.
  2. **AI Roleplay:** Practice speaking with "AInur" (an AI tutor) specifically prompted for that topic.
  3. **Guided Peer Call:** Connect instantly to a human peer who is on the *exact same topic*. Both users receive mission cards (icebreakers) to practice their new skills safely. 
- **WHY NOW:** The barrier to integrating low-cost, low-latency conversational AI (like Gemini Flash and DeepSeek) has plummeted, allowing us to combine the safety of a structured AI tutor with the real-world connection of peer-to-peer audio.

### 3. Monetization Strategy (The Pivot)
- **Core Loop is Free:** Peer-to-peer voice calls are free but capped at 30 minutes daily to build a high-retention daily habit.
- **Premium Value:** Monetization is driven by technology and curriculum. Users pay for the "28-Topic Masterclass", which unlocks the structured roadmap, Unlimited AI Voice Analysis (grammar/pronunciation corrections via Whisper + LLM), and priority matchmaking.

### 4. Proof of Concept — What Actually Works Today
- **Real-time matchmaking:** *Working.* Uses Firestore-based queuing to connect users.
- **Live voice calls:** *Working.* Powered by Agora RTC with a 30-minute daily cap.
- **AI post-call analysis:** *Working.* Post-call vocabulary quizzes and feedback powered by DeepSeek/OpenAI.
- **Picture Describing & Translations:** *Working.* In-call tools to prevent awkward silences.
- **Badge/gamification system:** *Working.* Streaks and peer ratings.
- **Telegram Mini App integration:** *Working.*
- **Native Android APK status:** *In progress.* Built as a PWA running through Capacitor.

### 5. Technical Architecture
**Stack:** React (Frontend), Firebase (Auth, Firestore, Cloud Functions), Agora RTC (Audio streaming), Gemini 2.0 Flash / OpenAI / DeepSeek (AI features).
The application operates as a Progressive Web App (PWA) with a dedicated Telegram Mini App integration, and is wrapped via Capacitor for an upcoming Native Android APK release.

### 6. Solving Known Limitations
- **The "Cold Start" Matchmaking Problem:** Solved via the AI Tutor. If a peer isn't found instantly, the user is seamlessly offered a practice session with "AInur", ensuring zero wait-time frustration.
- **Cost Model at Scale:** Peer-to-peer Agora audio is extremely cheap. Expensive AI features (Whisper/LLM analysis) are heavily restricted on the Free tier (e.g., 3 per month) and funded entirely by Premium subscriptions.

### 7. What Feedback Poli Is Looking For
- Is the pivot from a "random chat app" to a "structured 28-topic peer+AI course" a strong enough wedge to attract A2 learners?
- Does solving the cold-start problem via an AI fallback make the app significantly more investable?
- What are the most effective marketing channels to test this 28-topic MVP on A2-level students?
