---
name: reference-edit
description: Copy the edit style of a reference reel/video onto SpeakLab founder footage — measure the reference first (cuts, zooms, captions, sound), write a numeric spec, then re-cut. Use for "make it like this reel/video", "copy this edit style", "edit it like the reference", "montaj bu kimi olsun", "bu videodakı kimi montaj et", or any request to analyse a reference video's editing.
---

# Reference edit — measure first, then cut

An edit style is a set of numbers (shot lengths, zoom ratios, caption px, sound positions). Copying it by eye gives
«something similar»; measuring it gives the thing. Worked example: F02 → `F02_v2_RefStyle` (2026-11-14, Polad: «overall
əvvəlkindən yaxşıdır»). Spec: `C:\Users\p\Desktop\Claude_Videos\Edit_Study_Research\REF_DdtBbI0AIt_rhythm.md`.

## 0. PC limits — before anything
- **One heavy job at a time** (ffmpeg / Playwright render / Whisper). Other sessions render too: check `tasklist` first.
- **Half the cores, low priority:** `cmd /c "start /belownormal /affinity 3F /wait /b python …"` (affinity 63) and `-threads 4`
  inside ffmpeg. The laptop overheats otherwise.
- **Intermediates on D:** (`D:\ref_study\…`, `D:\f02v2\…`). C: is small. Edit repo files with Edit/Write only.
- Anything over ~2 minutes runs in the background.

## 1. Measure the reference
```bash
cmd /c "start /belownormal /affinity 3F /wait /b python .claude/skills/reference-edit/scripts/measure_reference.py <video> [out_dir]"
```
One decode pass produces: `scene.txt` (scene score per changed frame), 10 fps thumbnails, timestamped contact sheets
(`sheet_N.jpg`, 4.8 s each), `onsets.json` (50 ms RMS, high/low-band onsets, quiet runs, cut candidates), `spec_draft.md`.

Then **read every contact sheet by eye** — this is where the spec comes from; the numbers only tell you where to look:
- score 1.00 = hard cut or flash; 0.4–0.9 = zoom cut / graphic change; a run of 0.1–0.25 = motion inside a shot.
  The score cannot tell a flash from a cut: look at the frames.
- For zooms, grab ~16 key frames at half resolution and measure **face width as % of frame width** per state.
- For captions, measure baseline y %, font px at 1080, words per card, and how many frames the in-animation takes.
- For sound, pair each visual event with an onset within ±0.1 s. An onset with no visual event is usually speech.

## 2. Write the spec
Use `templates/spec_template.md`. Rules:
- **One-line principle first** (what makes the reel work), then the tables.
- **Shot table** (in, out, length, what, transition in) + mean/median/min/max.
- **Event density per talking-head shot** — every caption start, keyword, overlay and zoom change with its time, and the mean gap.
  This is the number that matters most: the reference never leaves the face alone for more than ~1.3 s.
- **Hard numbers, no adjectives**: seconds, frames, px, %, dB.
- **Limits section**: what was measured vs inferred. Audio is *measured, not listened to* — say so.
- End with 8–12 numbered reusable rules, then the plan for our footage.
Save to `C:\Users\p\Desktop\Claude_Videos\Edit_Study_Research\REF_<id>_rhythm.md`.

## 3. Adapt, don't clone — and say where you departed
| Reference | Ours | Why |
|---|---|---|
| Speaker far from camera (face ≈ 30 % of width), zoom 1.00 / 1.30 / 1.55 | Polad frames close (face ≈ 55 %): **1.00 / 1.15 / 1.30**, 1.22 on a take framed tighter | A tighter state puts the chin on the caption |
| Caption at y 51 % (chest) | **Under the chin: line y ≈ 1380, keyword y ≈ 1458** (of 1920) | y 51 % is his mouth |
| Neon accent with glow | **Plum**: white → `#c9baff` gradient text, soft dark shadow, plum `#2b2764` label boxes | Brand: one purple family, nothing glows |
| Emoji / stickers | lucide-style line icons only | Brand: no emoji |
| Any display font | **Montserrat 600** (line) + **Anton** (keyword) | Both have «ə» and «Ə». Outfit lacks «ə», Manrope lacks «Ə»; Bebas Neue, League Gothic, Sofia Sans Condensed, Golos lack both |
| Words rewritten for punch | Never: his words and voice stay; a keyword slam is a word he says | Claude does visuals only |
Keep: start on speech, running line + one keyword slam per sentence, flash on every return to the face, overlays that
move the whole time, zoom reset only by flash/hard cut, CTA as a UI object (comment pill + cursor click).
Check a new font in Chromium before using it (canvas width with `monospace` vs `serif` fallback must match for «Əə»).

## 4. Build
Pipeline: `marketing/founder_02/v2/build_v2.py` + `stage_v2.html` (reads the kit in `marketing/motion_kit`).
```
master    4K takes → one cut at 1404×2496 (the widest state; tight states are crops, never upscales), voice as PCM
timeline  everything on the output clock: zoom keys, cutaway shots, captions, slams, chips, CTA pill, flashes, sfx cues
stills    python build_v2.py stills 1.0,2.05,…   → overlay PNGs; tile them on grey and LOOK before the long render
overlay   Playwright renders stage_v2.html frame by frame → alpha .mov
sfx       one-shots placed on the cues, level tied to the voice RMS
final     zoompan + overlay + voice + bed + sfx → −14 LUFS
```
For a new founder video copy `v2/` next to that video's `build.py` and change: `SRC`, `PIECES` (take, in, out on the WAV
clock), the word lookups in `build()` (zoom keys, slams, chips, cutaway shots, labels), `slamw`, `FIX`, output names.
Word timings come from that video's `work/<take>_words.json` (Whisper). After the final: 4 fps QA contact sheet of the
result, loudness (`ebur128`), voice-vs-final offset (must be 0.00 s), then a 6-frame original-vs-new still.

## 5. Sound
- **Sources.** FiftySounds (`fiftysounds.com/royalty-free-music/<category>.html`, files `music/sfx-*.mp3`): free for commercial
  use, attribution optional for sound effects, no redistribution → keep the files outside the repo (`D:\f02v2\sfxlib\`).
  Pixabay: free, no attribution, but the download is behind a Cloudflare check — only Polad can download; give him links.
  Ask before downloading from any new source.
- **Never choose a sound by numbers alone.** Measure tonality first: if one narrow peak holds > ~40 % of the energy it is
  a whistle/beep, not a whoosh (the first pick put a 1077 Hz whistle on 21 cues — Polad: «yersiz fit səsləri»).
- **Less is the default:** flash, keyword pop, a low hit on 3–6 big moments, a click on the CTA. Punch-ins and hard cuts
  stay silent — the music carries them.
- **Levels:** each one-shot 13–20 dB under the voice's speech RMS; bed `music_vol` 0.34 with ratio-3 sidechain ducking
  (Polad asked for the bed «a bit more audible» than F02's 0.16 / ratio 5) — measured ≈ 22 dB under the voice between
  words; the reference sits at 12–15 dB. Final −14 LUFS, true peak ≤ −1.5 dBFS.
- **Punch-ins:** 4–5 per 50 s, on the key claims only. More reads as a tic.

## 6. Traps (each cost a re-render)
- **Whisper word starts leave breaths in.** Take 65190: Whisper put «Üstəlik» at 0.80 s, speech really starts at 1.20 and
  0.6 s of breath was in the cut. Check every piece IN on the 10 ms envelope + zero-crossing rate: a breath is ≈ −35 dB
  with a high ZCR; cut in 0.08 s before the real onset. Sentence-end tails stay ≥ 0.25 s (quiet final syllables).
- **Phone audio starts 0.35–0.50 s after the video** (`ffprobe stream=start_time`): cut both streams at `+start_time`.
- **Pieces must be whole frames** (30 fps) or concat drifts ~20 ms per cut.
- **`zoompan` clamps zoom below 1.** The master must be the widest state (zoom 1 = whole frame).
- **Chin vs caption:** check the tightest state on every take; takes are framed differently.
- **A tightened pause is a jump cut** — hide it with a zoom change on the same frame.
- **Captions:** a line never crosses a flash, a cutaway boundary or a take; the keyword word is left out of the line.

## 7. Honesty
- Until Polad has heard it, the mix is **«measured, not listened to»** — write that in the report, with the numbers.
- Report every departure from the reference and every promise that did not hold (e.g. planned 44–47 s, got 50 s because
  the pauses were already cut).
- Deliver to `C:\Users\p\Desktop\Claude_Videos\SpeakLab\` as `<name>.mp4` + `<name>_CAPTION.txt` + `<name>_compare.jpg`.
  Never post. Report in Azerbaijani, short.
