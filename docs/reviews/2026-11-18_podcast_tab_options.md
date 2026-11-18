# Podcast tab (Listen) — layout options, 2026-11-18

**Trigger:** learner feedback via Polad. On a phone the subtitles sit too far down; you scroll past the media to follow along. Polad asked for options first, then a build.

**Decision (2026-11-18): Polad picked B.** Built without the Translate button data (hook only). Result screenshots: `new-phone-1-start.png` … `new-phone-4-words-step.png`, `new-desktop.png`. Rule: `docs/domain/app-screens.md` → «Listen tab = karaoke script».

Screenshots and mockups: `docs/reviews/2026-11-18_podcast_tab/`
(`mockups.html` holds all mockups; `?v=a|b|c|desk` shows one).

## What is there now (measured, episode 16, 375×812)

| | |
|---|---|
| `current-phone-1-top.jpg` | First screen: tabs (3 rows), a 16:9 picture, the player, speeds, three chapters, the hosts. No text from the episode is visible. |
| `current-phone-2-script.jpg` | The script, playing. The **«Show the script» button starts at 1283 px**, about 1.6 screens down, and the script is **hidden by default** («first listen without the script»). Once you read it, the play/pause button and the picture are off screen. The script box is only ~460 px high, with 17 px text. |
| `current-desktop.jpg` | 1366×768: picture left, but on the right «Before you listen» comes first. Only the first two script lines fit above the fold. |

The problems, in order:
1. The text is the main thing for A1–B1 learners, but it comes after everything else: picture, chapters, hosts, words.
2. Once the text is visible, you can't reach pause, repeat or speed without scrolling back up.
3. The current line looks only a little different from the others (a white card, same 17 px), so the eye loses its place.
4. You can't repeat one line, which is the most useful action for an A1 learner.

## Option A: live subtitle card (`option-a-phone.jpg`)

Shrink the picture to a 118 px band and put the player under it. Under the player goes a big card with the **current line in 23 px**, the previous and next lines dimmed, and an optional AZ/TR translation. One row of buttons sits under the card: *Line again · AZ · 0.9× · All*. «All» opens the full script. Before / Check / Talk stay below, as now.

- + The smallest change. One screen shows the picture, the player and the line.
- − Only one line of context. Pause is still near the top of the screen, not under the thumb.

## Option B: karaoke script with a control dock at the bottom (`option-b-phone.jpg`, `option-b-desktop.jpg`). **Recommended**

- The episode is split into its own steps: **Words · Listen · Check · Talk** (a segmented control inside the Listen tab). The Listen step holds **only the script**.
- The picture becomes a small header strip with a 64 px thumbnail, the title, the chapter and «Leyla is speaking».
- The script is always open. The current line is **large (21 px on a phone, 27 px on a computer)** and kept a third of the way down the screen. Lines already heard are dimmed. Tap a line to play from there. Key words stay tappable (the WordCard already exists).
- **A dock under the thumb:** progress bar with chapter ticks · Speed · **Again** (replays the current line from its `at`) · Play/Pause · **Next** (next line) · **Translate** (AZ/TR under the current line).
- On a computer: picture, controls and chapters on the left (as now), and on the right the steps plus the script at full height. The current line is readable on a shared screen without zooming (memory rule `topic-sheet-shared-screen`).
- «First listen without the script»: a **blur** setting replaces hiding. The lines are visible but blurred, and one tap shows them. The layout doesn't jump, and the learner still sees where the line is.

- + The text owns the screen. Every control is under the thumb. It also solves the long scroll (Before / Check / Talk move into their own steps).
- − The biggest change. Before/Check/Talk move from one long page into steps, and the desktop layout changes too.

## Option C: subtitles mode, like a film (`option-c-phone.jpg`)

The current page stays. A «Subtitles» button opens a full-screen dark view: the picture on top, **one line at a time at 27 px** in the middle, and the same dock at the bottom.

- + The strongest focus, and it feels like a «film». The current page doesn't change, so the risk is low.
- − Learners don't see the conversation, only one line at a time. It is a second screen to find (a button again), and the dark full screen doesn't work on a shared computer screen.

## Shared parts (needed whatever is chosen)

- **Again** (repeat the current line) and **Next** come from the `at` timestamps already in the data. No new data is needed.
- An **auto-pause after each line** setting (for shadowing: hear it, say it, go on) could come later. It is easy to add to the dock.
- **Line translation (AZ/TR):** the data has no line translations; only word meanings (`useMeaningLang`) exist. Adding them means new fields `lines[i].az` / `lines[i].tr` in 60 × ~23 lines. Generating them once with an LLM and checking them by hand is a separate content job. Option: build the first version **without** the Translate button and add it when the data is ready (the button is not shown while there is no data).
- Plum tokens, `src/components/ui`, lucide icons, no glow. The current line gets a 4 px `--accent` left border plus `--glass-lift`, not a colour fill.

## Recommendation

**B.** The complaint is that you have to scroll to follow the text. B removes the scroll by design: the text is the screen and the controls are under the thumb. A leaves pause up top. C hides the context and doesn't work on the teacher's shared screen. Build order: (1) B without Translate, (2) line translations as data, (3) the Translate button.

Files for the build: `src/components/materials/PodcastEpisode.jsx`, `materials.css`; `DailyTopicModal.jsx` stays as it is (the Listen tab only mounts the component). Rule in `docs/domain/app-screens.md`, to update after the build.
