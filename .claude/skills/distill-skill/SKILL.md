---
name: distill-skill
description: After finishing a task, capture what was learned into a reusable project skill (or memory / CLAUDE.md). Use when the user says "make a skill for this", "remember how we did this", "so next time is faster", or after solving something non-obvious that cost real effort to figure out.
---

# Distill the session into a skill

Turn knowledge that was expensive to acquire into knowledge that is free next time. Run this **after** the work is done, while the details are still in context.

## Step 1 — Decide WHERE it belongs

Three layers exist. Picking wrong means it never gets read.

| Layer | Loaded | Use for |
|---|---|---|
| **CLAUDE.md** (repo root) | **Every session, always** | Facts true for all work: stack, deploy safety, domain invariants, conventions. Keep it short — it costs context every time. |
| **Skill** (`.claude/skills/<name>/SKILL.md`) | Only when the task matches | A *procedure* for a recurring task: deploy, release, author a function, publish content. |
| **Memory** (`~/.claude/projects/.../memory/`) | Index every session | Point-in-time project state, user preferences, credentials/IDs, "what we decided". Not procedures. |

Rule of thumb: **"how to do X" → skill. "what is true about this project" → CLAUDE.md. "what happened / what we chose" → memory.**

## Step 2 — Decide IF it's worth capturing

Capture only knowledge that is **non-obvious AND durable AND recurring**.

✅ Worth it: a trap that cost real debugging (double IME inset; PowerShell writing UTF-16 into `.properties`); a multi-step procedure with ordering that matters (`build → cap sync → bundleRelease`); a rule whose violation is silent (Firestore catch-all deny; data-only web push needing `Urgency: high`).

❌ Skip it: anything already in git history, the code, or CLAUDE.md; one-off answers; generic knowledge I already have (how React works); facts that will be stale next month — those are memory, not a skill.

If you catch yourself explaining the same non-obvious thing a second time, that is the signal.

## Step 3 — Write it

Location: `.claude/skills/<kebab-case-name>/SKILL.md`.

> ⚠️ **`.claude/skills/` is the only path that works.** Skills placed in `.agents/skills/` (or anywhere else) are never loaded — this project shipped two dead skills that way for weeks.

Frontmatter is mandatory; the `description` is the **trigger**, so name the words the user will actually say:

```yaml
---
name: android-release
description: Build a signed SpeakLab Android AAB/APK with Capacitor — sync, keystore signing, versionCode, and the keyboard/safe-area traps. Use for any Android build, APK, AAB, Play Store, or Capacitor task.
---
```
A vague description ("helps with Android") will not fire. Say *what it does* + *when to use it*.

Body style used in this project — match it:
- Lead with the command or the decision, not background.
- Cite real paths and `file:line`; quote actual identifiers, not placeholders.
- Include a **why** for anything counter-intuitive, or someone will "fix" it back.
- Call out ordering traps and silent-failure modes explicitly.
- Cross-link sibling skills by name so one entry point reaches the rest.
- Concise. A skill is a checklist for an expert, not a tutorial.

## Step 4 — Verify it actually loaded

After writing, confirm the skill appears in the available-skills list with its description. If it does not, the path or frontmatter is wrong — fix before moving on. Do not assume.

## Step 5 — Commit it

Skills are project assets; uncommitted ones are lost on a fresh clone.
`git add .claude/skills/<name> && git commit` — see `firebase-deploy` before pushing (push to main = production).
