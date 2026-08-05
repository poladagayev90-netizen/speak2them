// Backfill-in gətirdiyi TƏKRAR kompozisiyaları hədəflənmiş sorğularla əvəz edir.
//
// PROBLEM: `backfill_topic_images.js` mövzunun öz `imageKeywords` ifadələrini
// işlədir, sadəcə page=2-dən. Eyni sorğu eyni tipli kadr qaytarır — nəticədə
// gözlə baxışda ATILAN kompozisiya geri gəldi (mövzu 8-ə yenə üç «əldə telefon»,
// mövzu 11-ə ikinci-üçüncü gitara, mövzu 21-ə üçüncü-dördüncü gecə səması).
//
// HƏLL: hər problemli mövzu üçün ƏL İLƏ yazılmış, dəstdə OLMAYAN səhnəni
// təsvir edən sorğular. Yalnız `reviewed` OLMAYAN kadrlar əvəzlənir — gözlə
// baxışdan keçmiş 306 kadra toxunulmur.
//
// İSTİFADƏ: node scripts/rebackfill_diverse.js

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../src/data/topicImages.js');

// Mövzu → dəstdə olmayan səhnələr. Hər sətir qəsdən başqa bir kadr tipidir.
const QUERIES = {
  1:  ['family road trip car window', 'passenger train window landscape'],
  2:  ['engineer repairing computer motherboard', 'robot vacuum cleaning living room'],
  8:  ['vlogger filming outdoors camera', 'friends taking group photo party', 'editor editing video studio'],
  11: ['drummer playing drum kit', 'pianist playing grand piano'],
  13: ['man fishing lake morning', 'photographer taking pictures nature'],
  14: ['model backstage makeup fashion show', 'shoemaker repairing shoes workshop'],
  17: ['friends playing board game together', 'friends cooking together kitchen'],
  18: ['basketball player jumping hoop', 'cyclist riding bicycle race'],
  21: ['chemist mixing liquids beaker laboratory', 'engineer testing robot workshop', 'students biology class experiment'],
  23: ['book club group discussion', 'bookshop owner arranging shelves'],
  25: ['market vendor selling vegetables customer', 'courier delivering parcel doorstep'],
  26: ['young entrepreneur presenting idea', 'climber indoor climbing wall'],
  28: ['engineer flying drone test', '3d printer printing object closeup'],
};

function apiKey() {
  if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY.trim();
  try {
    const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
    const m = env.match(/^\s*PEXELS_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* yoxdur */ }
  return null;
}

function load() {
  let src = fs.readFileSync(OUT, 'utf8')
    .replace(/export const topicImages =/, 'module.exports =')
    .replace(/export default topicImages;?/, '');
  const tmp = path.join(require('os').tmpdir(), `ti-rb-${Date.now()}.js`);
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

const STOP = new Set(['a','an','the','of','in','on','at','to','and','with','for','near','beside',
  'front','while','during','his','her','their','wearing','holding','photo','image','shot','view',
  'closeup','close','up','white','black','blue','red','green','gray','grey','brown']);
const kw = (alt) => [...new Set((alt || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
  .filter((w) => w.length > 2 && !STOP.has(w)))].slice(0, 5);
const cw = (alt) => new Set((alt || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
  .filter((w) => w.length > 3 && !STOP.has(w)));
function tooSimilar(alt, list) {
  const a = cw(alt);
  if (!a.size) return true;
  for (const e of list) {
    const b = cw(e.alt);
    if (!b.size) continue;
    let i = 0; for (const w of a) if (b.has(w)) i++;
    if (i / (a.size + b.size - i) > 0.4) return true;
  }
  return false;
}
const PEOPLE = /\b(man|woman|men|women|people|person|child|children|kid|boy|girl|family|guy|lady|group|crowd|team|couple|student|teacher|worker|chef|doctor|nurse|player)\b/i;
const ACTION = /\b(sitting|standing|walking|running|holding|working|cooking|eating|talking|playing|reading|writing|smiling|using|wearing|carrying|teaching|training|riding|shopping|cleaning|building)\b/i;
const score = (p) => (PEOPLE.test(p.alt || '') ? 3 : 0) + (ACTION.test(p.alt || '') ? 2 : 0)
  + ((p.alt || '').split(/\s+/).length >= 6 ? 1 : 0);

async function search(query, key) {
  const url = 'https://api.pexels.com/v1/search?' + new URLSearchParams({
    query, per_page: '20', orientation: 'landscape',
  });
  const res = await fetch(url, { headers: { Authorization: key } });
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  return (await res.json()).photos || [];
}

(async () => {
  const key = apiKey();
  if (!key) { console.error('PEXELS_API_KEY tapılmadı'); process.exit(1); }

  const topics = load();
  const globalIds = new Set();
  for (const d of Object.keys(topics)) for (const im of topics[d]) globalIds.add(im.id);

  let replaced = 0, limited = false;

  for (const [dayStr, queries] of Object.entries(QUERIES)) {
    if (limited) break;
    const day = Number(dayStr);
    const kept = topics[day].filter((im) => im.reviewed);
    const need = topics[day].length - kept.length;   // əvəzlənəcək kadr sayı
    if (!need) { console.log(`  day ${day}: əvəzlənəcək yoxdur`); continue; }

    // Əvəzlənən kadrların id-si azad olur ki, qlobal yoxlama onları bloklamasın.
    for (const im of topics[day]) if (!im.reviewed) globalIds.delete(im.id);

    const photographers = new Map();
    for (const im of kept) photographers.set(im.credit, (photographers.get(im.credit) || 0) + 1);

    const found = [];
    for (const q of queries) {
      if (found.length >= need) break;
      let photos;
      try { photos = await search(q, key); }
      catch (e) { if (e.message === 'RATE_LIMIT') { limited = true; break; } continue; }
      photos.sort((a, b) => score(b) - score(a));
      for (const p of photos) {
        if (found.length >= need) break;
        const id = String(p.id);
        if (globalIds.has(id)) continue;
        if ((photographers.get(p.photographer) || 0) >= 2) continue;
        if (tooSimilar(p.alt, kept.concat(found))) continue;
        globalIds.add(id);
        photographers.set(p.photographer, (photographers.get(p.photographer) || 0) + 1);
        found.push({
          id, url: p.src.large, fallbackUrl: p.src.medium,
          alt: p.alt || q, keywords: kw(p.alt), prompts: [],
          credit: p.photographer, src: 'pexels',
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    topics[day] = kept.concat(found);
    replaced += found.length;
    console.log(`  day ${day}: ${need} əvəzləndi → ${found.length} tapıldı, cəmi ${topics[day].length}`);
  }

  fs.writeFileSync(OUT, serialize(topics), 'utf8');
  console.log(`\nƏvəzləndi: ${replaced} kadr.` + (limited ? ' (RATE LIMIT)' : ''));
})();
