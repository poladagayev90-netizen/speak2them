// Gözlə baxışda atılan kadrların yerini hovuzdan doldurur.
//
// NİYƏ HOVUZDAN, YENİ SORĞUDAN YOX: 2026-08-05 dərsi — eyni sorğunun `page=2`-si
// eyni tipli kadrı qaytarır, ona görə atılan kompozisiya geri gəlirdi. Hovuzda
// 3900+ kadr var və atılanın SƏHNƏSİ qara siyahıya alınır: əvəz həmişə başqa
// səhnədən gəlir.
//
// İSTİFADƏ: node scripts/backfill_from_pool.js --pool <hovuz.json>

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../src/data/topicImages.js');
const PER_TOPIC = 12;

function load() {
  const src = fs.readFileSync(OUT, 'utf8')
    .replace(/export const topicImages =/, 'module.exports =')
    .replace(/export default topicImages;?/, '');
  const tmp = path.join(require('os').tmpdir(), `ti-bf-${Date.now()}.js`);
  fs.writeFileSync(tmp, src, 'utf8');
  const t = require(tmp);
  fs.unlinkSync(tmp);
  return t;
}

const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'and', 'with', 'for', 'from',
  'near', 'beside', 'front', 'while', 'during', 'his', 'her', 'their', 'photo', 'image', 'shot',
  'view', 'closeup', 'close', 'up', 'standing', 'sitting']);
const keywordsFromAlt = (alt) => [...new Set(String(alt || '').toLowerCase()
  .replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))].slice(0, 5);

const poolPath = process.argv[process.argv.indexOf('--pool') + 1];
if (!poolPath) throw new Error('--pool <hovuz.json> lazımdır');
const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
const topics = load();

const usedIds = new Set(Object.values(topics).flat().map((p) => p.id));
// Atılan kadrın səhnəsi bu mövzuda bir daha işlənmir.
const rejectedScenes = JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--rejects') + 1] || '{}', 'utf8').toString() || '{}');

let filled = 0;
for (const day of Object.keys(topics)) {
  const list = topics[day];
  if (list.length >= PER_TOPIC) continue;
  const have = new Set(list.map((p) => p.scene));
  const banned = new Set([...(rejectedScenes[day] || []), ...have]);
  const candidates = Object.entries(pool)
    .filter(([q]) => !banned.has(q))
    .flatMap(([q, v]) => v.photos.map((p) => ({ ...p, scene: q })))
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => b.score - a.score);

  const usedScenesNow = new Set();
  for (const p of candidates) {
    if (list.length >= PER_TOPIC) break;
    if (usedScenesNow.has(p.scene)) continue; // hər boşluq AYRI səhnədən
    usedScenesNow.add(p.scene);
    usedIds.add(p.id);
    list.push({
      id: p.id, url: p.url, fallbackUrl: p.fallbackUrl, alt: p.alt,
      keywords: keywordsFromAlt(p.alt), prompts: [], credit: p.credit,
      scene: p.scene, src: 'pexels', reviewed: false,
    });
    filled += 1;
  }
}

const header = fs.readFileSync(OUT, 'utf8').split('export const topicImages')[0];
let body = 'export const topicImages = {\n';
for (const day of Object.keys(topics).map(Number).sort((a, b) => a - b)) {
  body += `  ${day}: [\n`;
  for (const img of topics[day]) body += '    ' + JSON.stringify(img) + ',\n';
  body += '  ],\n';
}
body += '};\n';
fs.writeFileSync(OUT, header + body);
console.log('dolduruldu:', filled, 'kadr');
