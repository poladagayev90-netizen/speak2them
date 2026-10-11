// Checks podcast scripts before they go to AI Studio:
//   node scripts/check-podcast.cjs 03 04 05
// - 23 lines, Leyla/Sam alternating from Leyla (the TTS page's 23 blocks are reused as they are)
// - every topic word and idiom used (Polad's rule, same matching as utils/topicMaterials.js)
// - 6 questions with a valid answer index, chapters pointing at real lines
// Prints the TTS lines (tags as <tag>) to content/materials/NN/tts-lines.json.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'src/data/weeklyContent.js'), 'utf8')
  .replace(/^import .*$/m, '').replace('export const weeklyContent', 'globalThis.__wc').split('export function')[0];
// eslint-disable-next-line no-eval -- our own data file
eval(src);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let bad = 0;
for (const nn of process.argv.slice(2)) {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, `content/materials/${nn}.podcast.json`), 'utf8'));
  const topic = globalThis.__wc[Number(nn) - 1];
  const errs = [];
  if (p.lines.length !== 23) errs.push(`${p.lines.length} lines (want 23)`);
  p.lines.forEach((l, i) => { if (l.s !== (i % 2 ? 'Sam' : 'Leyla')) errs.push(`line ${i} speaker ${l.s}`); });
  const all = p.lines.map((l) => l.t).join(' \n ');
  const phrases = [...topic.vocabulary.map((v) => v.word), ...topic.idioms.map((v) => v.phrase)];
  const unused = phrases.filter((ph) => !new RegExp(`\\b${esc(ph)}(?:s|es|ed|d|ing)?\\b`, 'i').test(all));
  if (unused.length) errs.push(`unused: ${unused.join(', ')}`);
  if (p.questions.length !== 6) errs.push(`${p.questions.length} questions`);
  p.questions.forEach((q, i) => { if (!(q.answer >= 0 && q.answer < q.options.length)) errs.push(`q${i} answer`); });
  p.chapters.forEach((c) => { if (!p.lines[c.from]) errs.push(`chapter ${c.title} from`); });
  const words = all.replace(/\[[^\]]*\]/g, '').split(/\s+/).filter(Boolean).length;
  console.log(`${nn} ${topic.topic}: ${words} words ${errs.length ? 'FAIL ' + errs.join('; ') : 'ok'}`);
  if (errs.length) bad += 1;
  const dir = path.join(ROOT, `content/materials/${nn}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tts-lines.json'), JSON.stringify(p.lines.map((l) => l.t.replace(/\[([a-z -]+)\]/g, '<$1>'))));
}
process.exit(bad ? 1 : 0);
