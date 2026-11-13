---
name: viral-reel-editing
description: Programmatic 9:16 (1080x1920) viral Reel motion graphics, SFX choreography, After Effects-style UI/depth compositing, and talking-head finishing. Use when creating promo/ad Reels, kinetic typography loops, animated UI card sequences, bento grids, iOS lockscreen cascades, or code-driven HTML-to-MP4 videos for SpeakLab or Qat-Qat.
---

# Viral Reel Editing & Motion Graphics

Deterministic 9:16 (`1080x1920 @ 30fps`) motion design and SFX rules distilled from reference Reels (`DdtBbI0AIt_`, `De9DKKssi7a`, `DeUQCEbDPM7`, `DerGGQsFW_p`) and adapted to this repo's Chromium + FFmpeg pipelines.

- **Copying a specific reference onto founder footage?** Load `reference-edit` first (`measure_reference.py`, measured cut/zoom rhythm, and PC thermal rules).
- **Content planning / 30-Reel scripts / publishing?** Load `speaklab-content`.
- **Role split (Polad 2026-11-11):** in Claude Code, do visuals and edits only. Voice-over/TTS (§3 Gemini TTS) and scripts are Antigravity's. Use the TTS notes only when handling audio Antigravity delivered, or when Polad explicitly asks Claude to voice. Narration is always one long continuous take, never stitched sentences.
- **Laptop limits:** one heavy render at a time, at half the cores (affinity 63 / BelowNormal or `-threads 4`), intermediates on D:.

## 0. Brand & Hardware Adaptation (Non-Negotiable)

Reference Reels use neon cyan, lime green, coral-orange, or emojis — **translate visuals before rendering for SpeakLab**:

| Domain | Palette & Type Rules | Source |
|---|---|---|
| **SpeakLab** | **Plum only:** dark canvas `#08060E` / `#130D21`, plum `#2b2764` pills/cards, white → `#c9baff` gradient accents. Coral `#F26D5B` for progress indicators only (never text). Soft dark shadows only — **no neon glow**. **Zero emoji** (lucide SVG line icons only). **100% mascot-free** by default (only original `public/logo.svg` kolba if asked). | `CLAUDE.md`, `reference-edit` |
| **Azerbaijani Fonts** | Use **`Montserrat`** (600/800) + **`Anton`** (or `Plus Jakarta Sans` where verified). Both contain `ə`, `Ə`, `İ`, `ç`, `ğ`, `ö`, `ş`, `ü`. Any new font MUST be tested in Chromium for `Əə` glyph width before rendering. | `reference-edit` |
| **Qat-Qat** | Dark editorial STEM/documentary style per `C:\Users\p\Desktop\qatqat\QATQAT_PLAYBOOK.md` (100% Azerbaijan hook). | `docs/MONTHLY_DIRECTIVE_2026-11.md` |
| **CPU / Disk Safety** | Run only ONE heavy job (`ffmpeg` / Playwright / Whisper) at a time; check `tasklist`. Wrap heavy runs with `cmd /c "start /belownormal /affinity 3F /wait /b ..."` and ffmpeg `-threads 4`. Put large intermediates on `D:\` if needed. | `reference-edit` |

## 1. Visual & Motion Pattern Library (9:16 HTML/CSS/SVG)

Never leave the viewport static for more than **1.3–2.0 s**. Choose techniques by beat function:

### A. Talking-Head Mixed-Media & UI Proof (`DdtBbI0AIt_` + `promo-ad-engine`)
1. **Spatial Mid-Chest Hook + Dual Pop-In Cards (`0.0–2.0 s`):** Reveal hook words around lower/chest safe zone (or seam `y=832` in split mode — never over face/chin). Pair with 2 side-by-side rounded glass cards (`border-radius: 24px`, `2px` border) scaling in via spring `cubic-bezier(0.34, 1.56, 0.64, 1)` + pop SFX.
2. **Foreground Whip-Pan Mask Cut (`0.18 s`):** Sweep a blurred dark foreground card/element across `translateX(100% → -100%)` to mask a jump-cut into a tighter crop (`1.15x` / `1.22x`) + deep low-end whoosh.
3. **3x3 Bento Video Grid Zoom-Out (`InfiniteCanvasMacroZoomOut`):** Lay out 9 vertical cards (`grid-template-columns: repeat(3, 1fr)`, `gap: 16px`, `border-radius: 28px`) playing live clips simultaneously, then animate parent container from `scale(2.8)` → `scale(1.0)` so the audience pulls back to see scale/proof.
4. **Blueprint Ruler Axis + 4 Corner Cards + Center Pill:** Subtle `40px × 40px` hairline grid background + vertical numbered axis (`-10, -5, 0, 5, 10`), 4 corner frame cards with Plum borders, and a central floating pill headline.
5. **Tactile Slap-Down Cutout Cards:** Overhead angled directional lighting (`linear-gradient(135deg, rgba(0,0,0,0.55), transparent)`). Stamp sequential cards from `scale(1.35) rotate(-8deg)` → `scale(1.0) rotate(2deg)` in `0.14 s` + crisp paper-slap / shutter SFX on each drop.
6. **iOS Lockscreen Notification Cascade:** Slide lockscreen (`translateY(100% → 0%)`, clock header) up into view, then cascade 3 glassmorphic notification cards (`WhatsApp`, `Instagram`, `SpeakLab`) at `0.25 s` intervals, scaling the newest item to `1.06x` with a notification pop.
7. **Live SVG Spline Chart + Rolling Counter:** Animate an `<svg>` `<path>` growth curve (`stroke-dashoffset`) synchronized with an ease-out number counter (e.g., speaking minutes / confidence score) and rapid digital ticks (`sfx_ticker.wav`). Pair with 2-tier typography above the card (setup line + oversized bold readout).
8. **Interactive Comment / Prompt Pill CTA (Finale):** Rounded search/comment pill containing the exact keyword to comment (e.g. `SPEAKLAB`) + pulsing send arrow button `(↑)` + vector cursor glide/click (`scale(0.86)`) + crisp click SFX.
9. **Deconstructed 3D UI Cards (`ExplodedSSCards`) & Bounding Box:** Never drop a flat tiny full-page screenshot. Split real app screens into 2–3 tilted dark cards (`rotateZ(-4deg) rotateY(-8deg)`), highlight the active button with a `2px` corner-handle rectangle (`FigmaBoundingBox`) or highlighter sweep (`width: 0% → 100%`), and drive focus with a curved cursor glide.

### B. Depth Layering, Roto & Optical Polish (`De9DKKssi7a`)
1. **3-Plane Depth Sandwich:** Render oversized display typography (`"DANIŞMAQ ASANDIR"`) and tilted frosted badges (`[↗]`, `[✓]`, `rotateY(-18deg) rotateX(10deg)`) at `z-index: 2` *behind* a foreground cutout/segmented speaker (`z-index: 3`) over a deep gradient canvas (`z-index: 1`).
2. **Macro Glass Icon → Shockwave Ring → 3D Core:** Scale into a single `backdrop-filter: blur(24px)` square tile, fire a radial ring (`scale(0.2 → 3.5)`, `opacity: 1 → 0`), and reveal a rotating 3D orb (`Three.js` or shaded CSS sphere).
3. **Directional Motion-Blur Mind-Map:** Expand connected UI nodes (`<svg>` lines + pill cards) using directional blur (`<feGaussianBlur stdDeviation="18,0">`) over 6–8 frames synced to rapid micro-clicks.
4. **Rack-Focus Word Pull:** Start secondary words blurred (`filter: blur(8px); opacity: 0.4`) and sharpen smoothly to `blur(0px); opacity: 1` exactly as the speaker hits the stressed word.

### C. Single-Mechanic Kinetic Pendulum Loop (`DeUQCEbDPM7`)
For short (`10–15 s`) looping typographic hooks without talking-head footage:
1. Hang a rounded square badge (SpeakLab Kolba / icon) from an anchor at `(540, -100)` with rod length `L ≈ 1050px` and deterministic pendulum angle:
   `theta(t) = theta_max * Math.cos(Math.PI * t / T_half)`
2. Stack two full-screen typography layers (`State A`: Pain question, dark ink / muted card; `State B`: Solution `"BURADA HAZIRDIR."`, bright white on Plum canvas).
3. On every frame, compute the diagonal line passing through `(540, -100)` and `(badgeX, badgeY)` and update `clip-path: polygon(...)` on State B so the swinging cord physically wipes A → B (and B → A on the return swing).
4. **Loop & SFX Lock:** Trigger a directional whoosh + subtle low thud at the exact center pass (`theta(t) == 0`), and finish on the exact starting phase `theta(0) = +theta_max` for a seamless Instagram/TikTok loop.

### D. Editorial UI & SaaS-Style Listicle Motion (`DerGGQsFW_p`)
1. **Slide Counter & Two-Tone Editorial Header:** Top-left uppercase kicker (`— RESEARCH FIRST`) + bold two-tone headline + discrete bottom-right step indicator (`01 / 08` ... `08 / 08`).
2. **macOS (`•••`) Window Accordion & Outlier Chart:** Sequential `1..4` cards expand one at a time, flipping the number circle into a checkmark badge (`✓`), then trigger a bar chart where 2 statistical `outlier` bars rise `3x` taller in accent color.
3. **Toggle → 30-Day Grid Cascade:** Switch toggle slides active, triggering a `25 ms`-staggered cascade populating a `6×5` calendar grid of mini Reel thumbnails.

## 2. Production Pipelines in This Repo

Pick the matching pipeline instead of writing a renderer from scratch:

### Pipeline 1: Split / Face / Full-Screen App Combos (`marketing/motion_kit/`)
Best for mixing real SpeakLab phone recordings with animated UI cards:
- Extract real app frames: `python marketing/motion_kit/frames.py <clip.mp4>` → `frames/<name>/`. (Missing app screens must be captured from real emulator/prod UI, never mocked.)
- Configure `timeline.json` using modes `"split"` (top animated UI panel + face `y 870..bottom`, `zoom: 0.85` showing head & shoulders, caption at `y 832`, coral progress bar `y 856`), `"face"`, or `"full"` (full-screen app demo, caption `y 1640`). See `marketing/motion_kit/README.md` (`kit.js`, `stage.html`). (**Never use the rejected circular bubble cam.**)
- Render alpha overlay + composite with `-14 LUFS` audio:
  ```bash
  node marketing/motion_kit/render.cjs timeline.json overlay.mov 30
  python marketing/motion_kit/compose.py
  ```

### Pipeline 2: Pure Programmatic 9:16 Motion (`code-motion-engine` / `promo-ad-engine`)
Best for kinetic loops, explorable UI showcases, or narrated explainers without camera footage:
- Reference styles/helpers live in `.agents/skills/promo-ad-engine/lib/` (`promo_tactics.css`, `promo_tactics.js`) and templates in `.agents/skills/code-motion-engine/templates/`.
- Implement deterministic `window.DUR`, `window.AUDIO`, `window.STILLS`, and `window.render(t)` in HTML, then render frames via Playwright:
  ```bash
  node .agents/skills/code-motion-engine/scripts/render_motion.js <anim.html> "<out.mp4>" --fps 30
  ```

### Pipeline 3: Fast-Cut Talking Head + B-Roll (`scripts/video_editor/`)
Best for founder talking-head Reels without Split-Screen:
- Silence trim > `0.35 s`, alternating `1.0x ↔ 1.14x` zooms synced to speech emphasis, transparent B-roll cards anchored in headroom `y = 104 px`, and PIL ink-bbox caption pills (`pad_x = 44, pad_y = 22` in `scripts/video_editor/render_final_video.py`) so Azerbaijani descenders (`g, y, p, ş, ç, ğ`) never clip.

## 3. Audio, Gemini TTS & SFX Rules

1. **Audio Discipline (from `reference-edit`):**
   - Measure SFX spectrum before using: reject narrow tonal peaks (`>40%` energy in one frequency sounds like a whistle). Store commercial-safe FiftySounds (`sfx-*.mp3`) assets outside git (`D:\f02v2\sfxlib\`) or generate procedural 48 kHz WAVs with:
     `python .agents/skills/promo-ad-engine/scripts/generate_ad_sfx.py` (`sfx_slash`, `sfx_ticker`, `sfx_key_type`, `sfx_crush_snap`, `sfx_whoosh_deep`, `sfx_marker_swipe`, `sfx_pill_pop`) or `python .agents/skills/code-motion-engine/scripts/procedural_sfx.py`.
   - **Never over-SFX:** Place whooshes/hits only on transitions, flashes, pendulums, card slams, and CTAs (`13–20 dB` below voice RMS). Leave hard speech punch-ins clean; let background music ducked via sidechain carry rhythm.
2. **Gemini 3.8 Flash TTS (No ElevenLabs):**
   - Voice: `Achird` (natural Baku `az-AZ` intonation) or `Charon` (`1.05x` cadence).
   - **C2PA Trap:** Always strip the trailing C2PA metadata chunk from Gemini TTS output (`extract_clean_pcm24_from_gemini_tts` pattern) before resampling to `48 kHz` stereo, or the last frames emit a paper-tear/pop artifact!
3. **Master Loudness & Sync:**
   - Normalize final mix to `loudnorm=I=-14:TP=-1.5:LRA=11` (true peak `<= -1.5 dBFS`). Voice-to-final offset must be `0.00 s`.

## 4. Mandatory QA Before Delivery

1. Render verification stills first (`stills` / `window.STILLS`) — inspect caption margins (`Əə` intact, chin clear), B-roll headroom, and dark contrast before running full encode.
2. After full MP4 render, generate a `4 fps` contact sheet, verify `ebur128` loudness (`-14 LUFS`), watch/scrub start-to-finish, and deliver to `C:\Users\p\Desktop\SpeakLab_Social_Videos\` or `C:\Users\p\Desktop\Claude_Videos\SpeakLab\`. Never state uninspected audio as "listened" — report measured dB/LUFS honestly.
