---
name: speaklab-content
description: Plan, script, batch-produce, and publish SpeakLab (@speaklab.az) & Qat-Qat social content — Instagram Reels/carousels, TikTok, YouTube Shorts, and 30-day competitor-backed content calendars. Use for any content strategy, scriptwriting, batch Reel planning, carousel creation, or social publishing task.
---

# Content Strategy, 30-Reel Pipeline & Publishing

Monthly targets live in `docs/MONTHLY_DIRECTIVE_2026-11.md`. For motion/video rendering load `viral-reel-editing` or `reference-edit`.

> **Who does what (Polad, 2026-11-11, still in force):** Claude Code makes **visuals and edits only**.
> **Scripts, voice-over (TTS), queue review, posting and analytics are Antigravity's.** In Claude Code, read the
> scripting (§1–2) and publishing (§3) parts as reference for briefing Antigravity, not as work to do yourself, unless
> Polad explicitly asks Claude for it in that session.
> **Posting slot:** every other day at **21:00 Baku** (moved from 19:30 on 2026-11-09 per IG Insights; strongest days
> are Sun / Wed / Thu). Source of truth: `C:\Users\p\Desktop\Claude_Videos\SpeakLab\_POSTED_STATUS.md`.

## 0. Non-Negotiable Content & Brand Rules

### SpeakLab (`@speaklab.az` IG/TikTok, `@speakllab` YT)
- **Visual Identity:** **Dark Plum system** (`#08060E` / `#130D21` canvas, `#2b2764` card surfaces, white → `#c9baff` accent typography, `#F26D5B` coral strictly for progress indicators). Soft shadows only, **no neon glow**, **no yellow/green/cyan accents**, **zero emoji inside rendered videos** (use lucide SVG line icons).
- **Fonts:** `Montserrat` (600/800) + `Anton` (verified for Azerbaijani `Əə`, `ç`, `ğ`, `ö`, `ş`, `ü`). Never overlap speaker face or chin.
- **Editorial Constraints:**
  - **100% mascot-free** by default (only original `public/logo.svg` kolba if specifically asked).
  - **No 21:00 ritual:** Removed on 2026-11-06 — SpeakLab is 100% **on-demand peer & AInur practice** (`3` free planned practices, then packages from Profile). Never mention a fixed evening hour or countdown.
  - **No dry school quizzes:** Lead with psychological tension, mystery, relatable speaking traps, or concrete mechanism proof — never textbook multiple-choice trivia.
  - **No topic duplication:** Check `SESSION_MEMORY.md` full video inventory before scripting any new concept.

### Qat-Qat (Science, Engineering, Geology, Neuro, Documentary)
- Target: build a **2–3 month reserve queue** in 1 month.
- Follow `C:\Users\p\Desktop\qatqat\QATQAT_PLAYBOOK.md`: every piece MUST carry a genuine **100% Azerbaijan connection**.

---

## 1. The 4-Stage Research-First 30-Reel Pipeline (Distilled from `DerGGQsFW_p`)

Never generate "30 random AI Reels from a template". Run agency sequencing:

1. **Stage 1 — Competitor & Niche Outlier Audit:**
   - Study top-performing recent Reels in the niche (language fluency / IELTS / communication coaching for SpeakLab; STEM / Baku / Earth mysteries for Qat-Qat).
   - Tag each reference format as `outlier` (`3x+` median channel views), `trending`, or `steady`. **Ignore averages — clone ONLY the mechanics of `outlier` hits.**
2. **Stage 2 — Outlier Structural Skeleton Extraction:**
   - Pull the exact beat timing (`0–3s` hook, visual proof pattern, pacing, CTA mechanism) into reusable skeletons:
     - *Result-First → 3 Steps* (UI proof + rapid split cards)
     - *Myth vs. Reality* (talking head + rack-focus keyword slam)
     - *Pain → Mechanism Split* (before/after fluency contrast, interactive app screen)
     - *Single-Mechanic Kinetic Loop* (`12–15s` pendulum wipe / visual paradox + punchy CTA)
3. **Stage 3 — Brand, Voice & Feature Lock:**
   - Filter every candidate idea through `docs/MONTHLY_DIRECTIVE_2026-11.md` and real SpeakLab features (on-demand matching, `AInur` post-call audio fluency report, shared call topics, free starter practices — no invented features, no app mockup hallucinations).
4. **Stage 4 — Script Batch & `marketing/content_calendar.json` Queue:**
   - Target slot: every other day at **21:00 Baku time (UTC+4)** (see the role/slot note at the top).
   - Output beat-timed script (`[0:00–0:03 Hook]`, `[0:03–0:15 Mechanism/Story]`, `[0:15–0:25 App Proof]`, `[0:25+ Comment CTA pill]`) + spoken Azerbaijani copy (`az-AZ`) + on-screen caption words + screen-recording checklist.

---

## 2. The 7 Claude Content Creator Skills (Distilled from `DfMq0e8Efiq`)

Apply this prompting & generation discipline on every content request:

1. **Specific Senior Role:** Act as an Azerbaijani short-form retention director & growth strategist, never a generic copywriter.
2. **Context Before Writing:** Always load `docs/MONTHLY_DIRECTIVE_2026-11.md`, `SESSION_MEMORY.md` inventory, and target account insights before drafting a single hook.
3. **Strict Tone & Output Format:** Write spoken `az-AZ` naturally (everyday Baku cadence, zero machine-translated Turkish phrasing or corporate fluff). Output exact timestamps, exact on-screen 1–3 word captions, and exact CTA keyword.
4. **1-to-Many Repurposing Matrix:** Squeeze 4 assets from every proven idea instead of starting from scratch:
   - Asset A: Talking-Head + Split App Demo Reel (`reference-edit` / `marketing/motion_kit/`)
   - Asset B: Faceless Kinetic Motion / Pendulum Loop Reel (`viral-reel-editing`)
   - Asset C: `4–5` Slide `1:1` or `4:5` Instagram Carousel (S1 Outlier Hook, S2–3 Visual Breakdown, S4 SpeakLab Mechanism, S5 Save/Comment CTA)
   - Asset D: Concise WhatsApp / Telegram channel post driving directly to `speaklab.az`
5. **Iterative Critique & Retention Gate:** Before showing scripts to Polad, attack your own first `3.0 s`: Is the first frame spoken immediately on speech onset? Would someone who knows zero English understand why they should care? Cut dead throat-clearing intros.
6. **Outlier Hook Pattern-Matching:** Pair every factual insight with a contrarian truth, measurable gap (`10 dəqiqə danış vs. 100 söz əzbərlə`), or concrete real-world moment.
7. **Audience Pain-to-Product Bridge:** Show *why* passive study fails (mental translation freeze, zero speaking reflex), then show SpeakLab app UI doing the exact fix — never pitch before earning curiosity.

---

## 3. Production & Publishing Safety

- **Always deliver finished videos for review first** (`C:\Users\p\Desktop\SpeakLab_Social_Videos\` or `C:\Users\p\Desktop\Claude_Videos\SpeakLab\`) unless Polad explicitly says to publish. Autonomous autopilot posting (`scripts/social_autopilot.cjs`) stays **paused** unless explicitly instructed to enqueue/post.
- **Instagram REST (Composio — preferred over CLI on Windows):**
  - Keys in root `.env` (no `REACT_APP_` prefix): `COMPOSIO_API_KEY`, `COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID` (`ac_z9GRf6aJkMrn`), `COMPOSIO_USER_ID` (`polad`), connected account `ca_ntYLAvlTnBNv`.
  - API base `https://backend.composio.dev/api/v3/`, header `x-api-key`.
  - **Publish `ig_user_id` = `17841475958781912`** (NOT the `275…` id returned by `GET_USER_INFO` or `DEFAULT_IG_USER_ID` in `scripts/post_to_socials.cjs`). Instagram accepts **JPEG** for images.
  - Carousel flow: `CREATE_MEDIA_CONTAINER` per image (`is_carousel_item:true, content_type:"carousel_item"`) → `CREATE_CAROUSEL_CONTAINER` (children + caption) → poll `GET_POST_STATUS` → `CREATE_POST`.
  - **Image hosting trick:** drop JPGs in `public/ig/<date-slug>/`, ask before pushing `main` (`vercel` serves them at `https://speaklab-app.vercel.app/ig/<date-slug>/…`; excluded from Android APK).
- **Multi-platform helper script (dry-run supported):** `node scripts/post_to_socials.cjs --dry-run --platform instagram --video "..." --caption "..."` (`marketing/content_calendar.json` tracks schedule history).
