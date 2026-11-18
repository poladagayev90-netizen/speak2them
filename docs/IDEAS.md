# SpeakLab — idea backlog

Ideas Polad wants kept, not yet planned or built. Nothing here is a rule or a
commitment; when an idea is picked up it gets a plan, and its rules move into the
matching `docs/domain/*.md` file. Add new ideas at the bottom with a date; mark
built ones `DONE (date, commit)` instead of deleting them.

## 2026-11-18

### 1. Splash: only the SpeakLab wordmark, animated
Drop the Wittgenstein quote card from the launch screen; keep only the SpeakLab
logo + wordmark in the centre, with motion (e.g. the flask bubbles / letters
build). Open: keep «Built by Polad» or not.
Note: the splash shows for ~1–2 s, so «interactive» means *animated*, not
tappable. Must stay Plum, nothing glows (`docs/domain/design.md`) — the current
soft halo behind the logo already breaks «nothing glows».

### 2. Podcasts at A2 level
A2 versions of the podcasts (today's listen/karaoke podcast tab). Same pipeline
(`scripts/build-podcast.cjs`, `podcast-tts.cjs`), simpler script per episode,
like the three-level readings (A2/B1/B2) already done for topic materials.

### 3. Extended vocabulary from an official dictionary
An «extended vocabulary» part built on a recognised source (e.g. a CEFR-graded
word list such as Oxford 3000/5000 or English Vocabulary Profile), so each word
carries an official level. Open: licensing — those lists have terms of use;
check before importing definitions/examples (word + level is usually safer than
copying definitions).

### 4. Teacher-focused SpeakLab (tutor ↔ student account switching)
A separate, teacher-centred experience: switch between tutor and student roles,
per-student portfolio (level history, lesson dates, topics covered). This is a
new interface, not a tweak — needs its own discussion, a full plan and testing
before going live. Must keep the invariant: the teacher sees mistake types,
never the conversation (`docs/domain/calls.md`).

### 5. In-app «Report a problem / Send feedback»
A feedback/bug-report entry like global apps have. Placement and flow to be
designed (likely Profile → Help & feedback, optional screenshot + device info,
lands in an admin-readable collection). No popups.

### 6. Share the app from inside the app
A «Share SpeakLab» action (native share sheet on Android via Capacitor, Web
Share API on web), with a store / web link.

### 7. (Long-term) SpeakLab as the lesson platform — no Google Meet
Tutors run lessons inside SpeakLab: join the lesson call from the app, an
in-house lesson-call ecosystem (whiteboard etc.). Admin-only first, later opened
to other teachers. Builds on the existing Agora call stack.

## Open problems (not ideas)
- Push tokens surviving sign-out — see «Known open debt» in `CLAUDE.md`. Phase 1
  (sign-out deletes the device token + read-only count script) built on branch
  `claude/chat-session-6wc91q`, not merged yet.
