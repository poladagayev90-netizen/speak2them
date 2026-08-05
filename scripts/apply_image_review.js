// Gözlə baxışın nəticəsini topicImages.js-ə tətbiq edir.
//
// NİYƏ AYRICA ADDIM: generator şəkli görmür, ona görə `keywords` avtomatik
// çıxarılır və `prompts` boş qalır. Şəklə həqiqətən baxandan sonra hər kadr üçün
// öz sözləri və öz sualları yazılır — "personalized" hissə budur. Bu skript
// həmin əl yazısını fayla köçürür və mövzunu `reviewed` kimi damğalayır ki,
// generator bir daha işə düşəndə üstündən yazmasın.
//
// GİRİŞ (JSON):
//   { "1": { "images": { "0": { "keywords": [...], "prompts": [...] },
//                        "9": { "drop": true } } } }
//   drop:true → kadr təsvir üçün yararsızdır, əvəzlənməlidir (siyahıdan çıxarılır).
//
// İSTİFADƏ: node scripts/apply_image_review.js <review.json>

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../src/data/topicImages.js');

function load() {
  let src = fs.readFileSync(OUT, 'utf8')
    .replace(/export const topicImages =/, 'module.exports =')
    .replace(/export default topicImages;?/, '');
  const tmp = path.join(require('os').tmpdir(), `ti-apply-${Date.now()}.js`);
  fs.writeFileSync(tmp, src, 'utf8');
  const t = require(tmp);
  fs.unlinkSync(tmp);
  return t;
}

function serialize(map) {
  const header = fs.readFileSync(OUT, 'utf8').split('export const topicImages')[0];
  let body = 'export const topicImages = {\n';
  for (const day of Object.keys(map).map(Number).sort((a, b) => a - b)) {
    body += `  ${day}: [\n`;
    for (const img of map[day]) body += '    ' + JSON.stringify(img) + ',\n';
    body += '  ],\n';
  }
  body += '};\n\nexport default topicImages;\n';
  return header + body;
}

const file = process.argv[2];
if (!file) { console.error('istifadə: node scripts/apply_image_review.js <review.json>'); process.exit(1); }

const review = JSON.parse(fs.readFileSync(file, 'utf8'));
const topics = load();
let kept = 0, dropped = 0, touched = 0;

for (const [dayStr, entry] of Object.entries(review)) {
  const day = Number(dayStr);
  const imgs = topics[day];
  if (!imgs) { console.log(`  day ${day}: SİYAHIDA YOXDUR, atlandı`); continue; }

  const next = [];
  imgs.forEach((img, i) => {
    const r = (entry.images || {})[String(i)];
    if (r && r.drop) { dropped++; return; }        // yararsız kadr — çıxarılır
    if (r) {
      if (r.keywords) img.keywords = r.keywords;
      if (r.prompts) img.prompts = r.prompts;
      if (r.alt) img.alt = r.alt;
      touched++;
    }
    img.reviewed = true;                            // generator bir daha yazmasın
    next.push(img);
    kept++;
  });
  topics[day] = next;
  console.log(`  day ${day}: ${next.length} qaldı` + (entry.note ? ` — ${entry.note}` : ''));
}

fs.writeFileSync(OUT, serialize(topics), 'utf8');
console.log(`\nTətbiq olundu: ${touched} kadr yeniləndi, ${dropped} atıldı, ${kept} qaldı.`);
console.log(`Yazıldı: ${OUT}`);
