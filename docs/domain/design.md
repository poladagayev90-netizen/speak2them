# Design system details (Plum palette, type, icons)

Moved out of CLAUDE.md on 2026-10-15 so it is read only when a task touches the UI. Facts are kept as written.

- Use the design tokens in `src/index.css` (spacing `--s-*`, radius `--r-*`, type `--fs-*`, z `--z-*`) and the primitives in `src/components/ui/` — no raw px, no raw colours.
- **Palette: Plum — ONE purple family.** `--peer`/`--accent` (deep purple) = a real person, `--ai` (lighter purple) = AInur; the five in-call activities are further steps of the same band. **No green, amber, teal or cyan anywhere.** Two exceptions: red (`--danger-solid` + `--ink-on-danger`) for destructive controls and wrong answers, and **coral** (`--coral` / `--coral-soft` / `--coral-ink`, added 2026-10-01) which means *progress* only — Lab charts, the score ring, a "+29" change chip, the Lab tab underline. `--coral` is a graphic colour (≥3:1), never text; text goes `--coral-ink` on `--coral-soft`. People and buttons stay purple. There is no `data-palette` switch — it was removed with the recolour. Nothing glows: `--glass-lift` is the only shadow a surface gets, and there is no page-wide radial background.
- **`--ai` vs `--ai-fill`:** `--ai` is for text, icons and borders; a FILLED AInur control takes `--ai-fill` with `--text-on-ai`. Using `--ai` as a fill fails contrast in light mode.
- Small `--text-secondary`/`--text-muted` text at 11–13px is `font-weight: 600`; bottom-nav labels are 700.
- UI icons come from `lucide-react`, never emoji. Emoji are fine in CONTENT (a topic label), never as an icon.
