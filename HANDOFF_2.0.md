# SpeakLab 2.0 — handoff

Everything below is **shipped and live** unless it says otherwise. Working tree
is clean; `main` is at `151375e` and Vercel auto-deploys from it.

---

## 1. What the product is now

The problem this release attacked: *"when I say my student go to talk someone,
everyone hesitates, no one can find someone there."* The app opened, nobody was
around, the learner left.

The loop it was rebuilt around:

```
Teacher assigns  →  Student practises with AInur  →  AInur reports  →  Teacher sees it
                              ↓
                    Ready for a real conversation
```

The human side was kept and improved, not replaced.

**Navigation:** `Today · Chats · AInur · Live · Profile`

| Screen | What it is |
|---|---|
| **Today** (`/`) | One question: what do I do now. AInur task (cyan), talk to someone (violet), today's topic. Always has an answer, even at 3am with nobody online. |
| **AInur** (`/ai-chat`) | Activity hub. Describe pictures, Free talk. Debate/Roleplay listed as not-yet. |
| **Practice** (`/practice`, `?mode=free`) | The session itself. Full-screen, covers the tab bar. |
| **Live** (`/live`) | Everything about talking to a person: search, searcher banner, slot board, people, level filters. |
| **Profile** | Stats, feedback language, accent palette, settings. Leaderboard moved here. |

---

## 2. Decisions that must not be quietly broken

**The conversational model never grades.** Correction is a separate call after
the session (`analyzeAiSession`). Pedagogically it is the delayed-correction
rule from `SPEAKLAB_TEACHER_HANDOFF.md`; technically it is what will let a future
Taboo be honest — the guessing context simply never receives the target word.

**Session turns are written server-side only.** `aiSessions` is
`allow write: if false`. The transcript is what the teacher's report is built
from; a client that could edit it could fabricate a session.

**Reports ride the existing pipeline.** `analyzeAiSession` produces a
`callAnalysis` document, so History, `AnalysisDetail`, `TeacherStudent` and the
roster rollup all work with no special case.

**Colour says who you are talking to.** `--accent`/`--peer` is a real person,
`--ai` is AInur. It is the only semantic colour in the product.

**The recording loop owns the audio.** See §4 — this one has already caused a
serious production bug once.

---

## 3. The design system

Minimal and neutral-first. Two rules: neutrals carry the UI and one accent
carries action; colour says who you are talking to. Measured target: **~7% of any
screen is colour, in two hue families.** Verify with a pixel census, not by eye.

- Scales in `src/index.css`: `--s-*`, `--r-*`, `--fs-*`, `--e-*`, and one
  z-ladder `--z-nav/sheet/stage/modal/toast`. Elevation is nearly nothing
  (`--e-1: none`) — a hairline border separates surfaces better than a shadow.
- Primitives in `src/components/ui/`: `Button`, `Card`, `Pill`, `Sheet`, `Stat`.
- **Palettes are data**: `data-palette` on `<html>` — `violet` (default),
  `ocean`, `forest`, `mono`. Only the two hues move; neutrals never do, so no
  user choice can break contrast. Applied pre-paint in the `public/index.html`
  boot script, same as the theme. Picker is in Profile.
- Light = deep accent + white text; dark = light accent + dark ink
  (`--text-on-accent`). Never reuse one accent value across themes.
- No raw px, no raw hex, no gradients, no glows. Icons are lucide; emoji never
  as an icon, and stripped from topic labels inlined into prose
  (`utils/topicLabel.js`).

**Recommendation on the default:** Mono is the strongest of the four — it proves
the layout works without colour doing any work, and the only hue on screen is
AInur. Violet is the brand, so it remains the default; changing that is a brand
call, not a design one.

---

## 4. Traps that have already cost real time

**Never run a hex→`var(--accent)` find-and-replace over `src/index.css`.** It
turns `--accent: #6d3beb` into `--accent: var(--accent)`, which CSS discards as
circular. The entire light theme silently loses its accent — the avatar vanishes
and the logo renders black. This happened.

**SVG `stop-color` will not resolve a variable that points at another variable.**
The logo rendered black in light mode until it was made flat.

**Chrome creates an AudioContext SUSPENDED.** A suspended analyser reports pure
silence. Treating that as "the learner stopped talking" is what cut people off
three seconds into every answer. `useAinurSession` resumes it explicitly and
only lets silence end a segment it has actually heard speech in.

**Never discard a finished recording.** The old hook handed the blob to whoever
happened to be awaiting a promise and dropped it if nobody was. Combined with an
`onstop` that closed the AudioContext (killing the timer's animation frame), the
button froze at 0:02 while the learner talked for a minute into a dead recorder.

**`llama-3.3-70b-versatile` returns `model_not_found` on this Groq account.**
`GROQ_CHAT_MODEL` is `openai/gpt-oss-20b`. gpt-oss spends part of `max_tokens`
on private reasoning before the answer — at 90 tokens AInur was cut off
mid-question. `modelParams()` handles it. `aiActivityTurn` walks
`AI_TURN_MODELS` at runtime so the next retirement heals itself.

**`functions/index.js` has MIXED line endings** — mostly CRLF, but the AInur
block is LF. A multi-line search-and-replace must try both.

**Prod bundle greps for Azerbaijani fail** — minification escapes non-ASCII.
Search for an ASCII string instead.

---

## 5. Verification — the standard

Polad's rule, after finding three defects I had shipped: *"you have to check all
yourself manually when you add content to app."* One happy-path turn is not
verification. AI features fail at the **seams**.

Before shipping anything AI-driven, drive the full loop with **distinct input at
each step** and assert on behaviour, not HTTP 200:

- does the reply name something the learner actually said?
- does item N+1 leak vocabulary that only existed in item N?
- do non-final turns ask exactly one question, and final turns none?
- does the UI wait for speech to finish before changing what is on screen?
- does one tap carry the whole session with no further taps?

Scripts live in the scratchpad under `pw/`: `behaviour.js` (grades AInur against
the deployed endpoint), `timing.js` (polls the DOM for premature picture
changes), `handsfree.js` (one tap, then hands off), `minimal.js` (screens ×
themes × palettes), `report_shot.js`.

**Generating test speech:** Windows SAPI, 48 kHz / 16-bit / mono, then
`--use-file-for-fake-audio-capture=<wav>`. Chromium's default fake device is a
sine wave — Whisper returns nothing and the test passes while proving nothing.
**The WAV must have trailing silence**, or the looping device makes VAD hear
speech forever and no segment ever ends.

```bash
CI=true npx react-scripts build
```

`CI=true` makes an ESLint warning fatal, and a warning breaks the Vercel deploy.
Use the **Bash** tool — PowerShell mangles the env prefix.

---

## 6. Where things live

| Thing | File |
|---|---|
| Recording / hands-free loop | `src/hooks/useAinurSession.js` |
| Session shell (both modes) | `src/pages/AiActivity.jsx` |
| Cached fixed-line speech | `src/utils/ainurVoice.js` |
| Live lobby state (shared) | `src/hooks/useLiveLobby.js` |
| Report renderer | `src/pages/History.jsx` → `AnalysisDetail` |
| Report styles | `src/styles/analysisReport.css` (`.rep-*`) |
| Tokens + palettes | `src/index.css` |
| Five-layer prompt | `functions/index.js` → `buildAinurPrompt` |
| Turn endpoint | `functions/index.js` → `aiActivityTurn` |
| Grading | `functions/index.js` → `analyzeAiSession` |
| Fixed-line TTS | `functions/index.js` → `speakLine` |
| Cost meter | `aiUsage/{uid}_{date}`, server-write only |

Deployed this release: `aiActivityTurn`, `analyzeAiSession`, `speakLine`, plus
model fixes to `generateQuiz` and `processAnalysisQueue`, plus the `aiSessions`
rules block.

---

## 7. Open items

**Blocking anything new:**

1. **The teacher end has never been observed working.** `analyzeAiSession` writes
   the same roster rollup a human call writes and `firestore.rules:293` already
   grants a linked teacher read access — but no report has been watched landing
   on a teacher's screen. `teacherEligible` requires several completed real
   sessions before a teacher can even generate a code. This is the reason the
   feature exists; it should be proven before Phase 3.

2. **Seven test accounts in production** — `TestVerify2Design`,
   `TestVerify2Turn` ×3, `TestVerify2Report`, `TestVerify2CallA/B`. Emails in
   `scratchpad/pw/shots/_account.txt`. Deletion has been blocked by the
   permission classifier in every session so far; Polad has to run it. An older
   `testverify.*` backlog is still there too.

**Decisions waiting on Polad:**

- **`reportMarkdown`** costs real tokens and now largely duplicates the
  structured fields, since it is folded behind "full notes". Cutting it lowers
  cost per analysis — but it is the only place the feedback reads as a teacher
  talking to you.
- **AI cost policy.** `aiUsage` counts; nothing blocks. The decision was
  deliberately deferred until there is real data. Rough figures: a
  describe-pictures session ≈ $0.036, free conversation ≈ $0.11 per 10 min
  (TTS-dominated, and now on Aura-2 at roughly double the previous rate).
- **Course/cohort conflict.** A free, complete AI journey competes with the paid
  cohort. Deferred; Phase 1 built activities, not a "course".

**Phases:** 1 is done. 2 (teacher task panel), 3 (Debate — 150 topics ready;
honest Taboo — 500 words ready; Roleplay), 4 (spoken placement — the current
`PlacementTest.jsx` is a written grammar quiz, the wrong instrument), 5
(Preply-style live), 6 (weekly report) are **not started**.

**Also worth knowing:** the Android AAB is far behind — the entire UI changed
this release, so a `cap sync` + rebuild is needed before the next Play upload.
`CLAUDE.md` was updated; `.claude/skills/verify/SKILL.md` now carries the
English selectors and the `/practice` flow.

---

## 8. What good looks like here

Polad's bar, in his words: *"main thing is app quality"* and *"this real product
level"*. Two things follow from how this release went:

- **Measure, do not eyeball.** The colour census, the pixel probes and the DOM
  polling each caught something that looked fine in a screenshot.
- **Fix the mechanism, not the symptom.** The stuck button was three defects in
  one; patching the timer would have left the dropped-audio path intact.
