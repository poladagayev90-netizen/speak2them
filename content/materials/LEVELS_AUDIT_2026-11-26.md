# Levelled podcasts — audit 2026-11-26

Polad (26.11): «podkastlarda səhvlər var idi, sözlərin tərcümələri və s. dəyişmirdi — levellərə görə fərqləri yoxla və generasiyanı davam etdir».

Branch `claude/levels-audit-1126` (not pushed, not deployed). Staging data lives in the main checkout's untracked `content/materials/NN/levels/` and `docs/reviews/*vocab*.csv`.

## Where the app reads the levels

- Listen tab → `PodcastLevels.jsx` loads `src/data/topicMaterials/levels/NN.json` (written by `scripts/publish-podcast-levels.cjs`). It holds, per level: title, lines + timings, audio URL, and `words` = the level's list (core words, phrasal verbs, idioms/chunks) taken from the vocab sheets.
- `PodcastEpisode.jsx` → `levelTerms(words)` marks those words in the script (`splitByTerms`) and shows them on the Words step; a tap opens `WordCard`, whose AZ / TR / EN switch picks `meaningAZ` / `meaningTR` / `meaning`.
- Live in the app since 21.11 (`69cdc33`): **13 topics** — 25–35, 38, 51. The other 47 topics have no level file, so the Listen tab shows no switch and plays the old B1 episode.
- `src/data/keywordGlossary.js` / `build_keyword_glossary.js` are the picture-keyword glossary (Describe deck). They have nothing to do with podcast levels.

## Do the levels really differ? Yes

- **Scripts:** in every topic A1 < A2 < B1 in average sentence length (A1 3.1–5.0 words, A2 4.3–6.4, B1 5.4–9.7). By word count, A1 is shorter than A2, which is shorter than B1. The exceptions are close calls: 12 (A2 172 / B1 169), 30 (A1 168 / A2 172), 34 (A2 186 / B1 184) and 56 (A2 207 / B1 200). In these the sentence length still separates the levels.
- **Word lists:** each level has its own list of 13–14 items, with only 0–4 items shared between two levels.
- **Vocabulary gate:** all 180 lists pass `scripts/vocab-check.py --gate`. `--lint-scripts` gives 50 pace warnings, all A1 sentences or chunks a little over the limit (41–57), and none of them blocks anything.
- **Data vs script:** the shipped lines match the current `script.json` in all 13 live topics, so the audio and text are the ones that passed the vocabulary audit.

## Why the translations «did not change» — four causes

1. **Missing TR/EN meanings (main cause).** The 2026-11-19 batch sheets have a single `az_gloss` column, and only the topic-25 pilot sheet had `meaning_tr` / `meaning_en`. In 12 of the 13 live topics, every word had AZ only. `localMeaning()` falls back to AZ, so pressing **TR** or **EN** on the word card showed the same Azerbaijani text.
2. **Wrong AZ sense.** About 30 AZ meanings came from the dictionary sense of the word, not the sense the episode uses. Examples:
   - «jam = cem, mürəbbə» in the traffic-jam episode;
   - «present = hədiyyə» where Sam is «better at the present than the past»;
   - «work out = idman etmək» where a plan is worked out;
   - «lift = lift» for «I need a lift to work»;
   - «season = mövsüm» for cooking;
   - «come out = ekrana çıxmaq» for the sun;
   - «rule = hökm etmək»;
   - «Knock on wood = Ağaca vur».

   The full list is below.
3. **Words listed but not marked in the script.** The highlighter matched only an ending on the whole phrase (`look around` + s/ed/ing). Phrasal verbs change on the verb, and the common verbs are irregular. So «looked around», «picked it up», «grew up», «woke me up» and «came back» were never marked: about 105 of the 546 live items. The script then looked like it marked the same few basic words at every level.
4. **The Check step disappears on a level.** `levelEpisode()` uses `lv.questions`, but no level script has questions. A level episode has Words / Listen / Talk only. There are no level-specific questions yet (needs writing + Polad's OK).

## What changed (branch `claude/levels-audit-1126`)

- `content/materials/levels-glosses.json` (new) gives AZ (sense-checked against the script), TR and EN for every item of the 13 live topics: 546 items, with a short EN line in our own words. **Polad approves before it goes live.**
- `scripts/publish-podcast-levels.cjs`:
  - merges the glosses over the sheet (the gloss wins);
  - drops duplicate items (38 A2 had «Fingers crossed!» and «Fingers crossed.»);
  - reports every level that still has words without TR/EN;
  - new `--data-only` mode rewrites the data of levels whose exact mp3 is already in Storage, with no upload.
- `src/data/topicMaterials/levels/{25…35,38,51}.json` are rewritten with `--data-only`. Only `words` changed. The audio URLs, lines, timings and durations are byte-identical (checked).
- `src/utils/topicMaterials.js` → `splitByTerms` now matches:
  - an inflected first word: looked around, costs an arm and a leg;
  - irregular forms: grew, woke, came, won, children;
  - e-drop / y→ied / doubled consonant: dancing, carried, chopped;
  - an object pronoun inside a two-word phrasal verb: picked **it** up, turn **it** down.

  Chunks stay fixed. The regex is cached per term list. Tests were added.
- The never-marked items fell from ~105 to ~42. Most of the rest sit inside a longer marked phrase («card» inside «Can I pay by card?»), which is by design. The true gaps are below.

## For Polad's OK

- **Sense fixes in the live topics** (old → new):
  - 26 A1 grow: böyütmək → böyümək
  - 26 A2 improve: yaxşılaşdırmaq → yaxşılaşmaq
  - 27 A2 present: hədiyyə → indiki zaman, bu gün
  - 27 A2 take in: sığınacaq vermək → başa düşmək, qavramaq
  - 28 A1 wake up: yuxudan durmaq → oyanmaq; oyatmaq
  - 28 A2 work out: idman etmək → fikirləşib tapmaq, həll etmək
  - 29 A2 dish: xörək → qab-qacaq; xörək
  - 30 A2 sweet: şirin → şirin; şirniyyat
  - 30 B1 set off: başlamaq → (fişəng) atmaq, partlatmaq
  - 31 A1 rule: hökm etmək → qayda
  - 31 A2 lift: lift → (maşınla) aparmaq; lift
  - 31 B1 trust: etibar → etibar etmək
  - 31 B1 work out: idman etmək → (plan) qurmaq
  - 32 A2 come out: ekrana çıxmaq → (günəş) çıxmaq
  - 32 B1 raining cats and dogs: leysan kimi yağır → vedrə ilə tökür
  - 33 A1 come on: qalx! → Hadi! Gəl!
  - 33 A2 Next stop, please: … → Növbəti dayanacaqda saxlayın
  - 33 B1 jam: cem, mürəbbə → tıxac
  - 34 A2 heat / taste: noun → noun; verb
  - 34 B1 season: mövsüm → ədviyyat vurmaq
  - 34 B1 come out: ekrana çıxmaq → alınmaq (nəticə)
  - 38 A1 Touch wood!: Ağaca toxun! → Tfu-tfu, göz dəyməsin!
  - 38 A2 Knock on wood.: Ağaca vur. → Tfu-tfu, göz dəyməsin!
  - 38 A2 Fingers crossed!: Barmaqlar çarpaz! → İnşallah alınar!
  - 38 B1 fortune: sərvət, tale → bəxt, tale; sərvət
  - 51 A2 grow: böyütmək → böyümək; yaşlanmaq
  - 51 B1 care: qayğı göstərmək → qayğı, qulluq

  Other AZ lines were only polished. The full old → new diff is in the shared notes folder (`az-changes.txt`).
- **Items in a list that the episode never says**, so the learner sees a chip but never hears it. Polad decides: drop the item or keep it as extra.
  - 27 A2 take in;
  - 27 B1 get off;
  - 30 A2 put in;
  - 34 A1/B1 put in (the script says «put the rice in»);
  - 51 A2 Take your time.;
  - 51 B1 act your age, better with age;
  - 31 B1 keep yourself to yourself (the script says «keeps themselves to themselves»).
- **Near-duplicates in one list:**
  - 34 B1 «a lot on my plate» + «have a lot on your plate»;
  - 35 A2 «grandparent» + «grandparents»;
  - 35 B1 «look back» + «look back on».
- **Level questions** (the Check step) do not exist yet. Writing 3 × 60 sets is content work and needs Polad's OK of a sample first.
- The **other 47 topics** still have AZ-only meanings. They need the same glosses file before they go live. The publish run now lists them, so none can ship silently.

## Audio generation (this run)

Queue = `node scripts/levels-tts.cjs --due`: topics 25–60 first (Polad's order), then 01–24. Each recording goes straight through `levels-qa.py`. The run stops at the first quota error, since the TTS limit is 100 requests per rolling 24 h. It ran at half the cores and low priority, one job at a time. Several A1 episodes in 40–42 «fail» QA on silence share (28–31 % against the 22–28 band), although their WPM is inside its band. The pause shaper already uses the band minimum. A retune of the A1 silence band (or of the TTS style) is Polad's/the pipeline owner's call. `publish` refuses QA-fail episodes, so none can ship by accident.

STATUS_TABLE
