// Builds content/materials/NN.podcast.json from a compact episode source:
//   node scripts/build-podcast.cjs content/materials/src/ep21.cjs [ep22.cjs …]
// Source shape (see content/materials/src/ep11.cjs): episode, title, predict, cover,
// chapters [[fromLine, title, scene]], lines[23] (Leyla first, alternating),
// questions [[type, q, options, answer, why]] (tf options are filled in), talk[2].
// Then: node scripts/check-podcast.cjs NN
// WARNING: rebuilding an episode that already has timings wipes its "at" values and duration —
// only build NEW episodes, or run set-timings again afterwards.
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
for (const f of process.argv.slice(2)) {
  const e = require(path.resolve(f));
  const nn = String(e.episode).padStart(2, '0');
  const out = {
    kind: 'podcast', episode: e.episode, title: e.title, level: 'B1',
    hosts: { Leyla: 'lives in Baku and loves a good plan', Sam: 'grew up in Manchester and once travelled with no plan at all' },
    before: { predict: e.predict },
    chapters: e.chapters.map(([from, title, prompt], i) => ({ from, ...(i === 0 ? { picFrom: 3 } : {}), title, image: `ch${i + 1}`, prompt: `CHAPTER ${i + 1} SCENE: ${prompt}` })),
    lines: e.lines.map((t, i) => ({ s: i % 2 ? 'Sam' : 'Leyla', t })),
    questions: e.questions.map(([type, q, options, answer, why]) => ({ type, q, options: type === 'tf' ? ['True', 'False', 'Not given'] : options, answer, why })),
    coverPrompt: e.cover,
    talk: e.talk,
  };
  const p = `${ROOT}/content/materials/${nn}.podcast.json`;
  fs.writeFileSync(p, JSON.stringify(out, null, 2) + '\n');
  console.log('wrote', p);
}
