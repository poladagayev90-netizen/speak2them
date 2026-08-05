// Gözlə baxışdan sonra 12-dən aşağı düşmüş mövzuları Pexels-dən tamamlayır.
//
// NİYƏ AYRICA SKRIPT: `generate_topic_images_pexels.js` mövzunu bütöv yenidən
// qurur və `reviewed` mövzulara toxunmur — yəni əl ilə yazılmış lüğəti qorumaq
// üçün onu buraxmaq olmur. Bu skript isə MÖVCUD dəstin üstünə əlavə edir.
//
// TƏKRARIN QARŞISI (baxışda tapılan bütün problemlərə görə):
//   1) artıq dəstdə olan foto id-si                    → atlanır
//   2) BAŞQA mövzuda işlənən foto id-si                → atlanır (mövzular arası təkrar)
//   3) dəstdə artıq 2 fotosu olan fotoqraf             → atlanır (eyni çəkilişin kadrları)
//   4) mövcud kadrla təsviri 45%-dən çox üst-üstə düşən → atlanır (eyni kompozisiya)
// Sorğu `page=2`-dən gedir ki, ilk keçiddə götürülən nəticələr təkrar gəlməsin.
//
// Yeni kadrlar `reviewed` OLMADAN yazılır — yəni onlara da gözlə baxılmalıdır.
//
// İSTİFADƏ: node scripts/backfill_topic_images.js [--target 12] [--days 1,2]

const fs = require('fs');
const path = require('path');

const WEEKLY = path.join(__dirname, '../src/data/weeklyContent.js');
const OUT = path.join(__dirname, '../src/data/topicImages.js');

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { target: 12, days: null };
  const ti = a.indexOf('--target');
  if (ti >= 0 && a[ti + 1]) out.target = Number(a[ti + 1]);
  const di = a.indexOf('--days');
  if (di >= 0 && a[di + 1]) out.days = a[di + 1].split(',').map(Number);
  return out;
}

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
  const tmp = path.join(require('os').tmpdir(), `ti-bf-${Date.now()}.js`);
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

function readPhrases() {
  const src = fs.readFileSync(WEEKLY, 'utf8');
  const out = {};
  const re = /day:\s*(\d+),[\s\S]*?imageKeywords:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out[Number(m[1])] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  return out;
}

const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'and', 'with', 'for',
  'near', 'beside', 'front', 'while', 'during', 'his', 'her', 'their', 'wearing', 'holding',
  'photo', 'image', 'shot', 'view', 'closeup', 'close', 'up', 'white', 'black', 'blue', 'red',
  'green', 'gray', 'grey', 'brown']);

function keywordsFromAlt(alt) {
  const w = (alt || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((x) => x.length > 2 && !STOP.has(x));
  return [...new Set(w)].slice(0, 5);
}
function contentWords(alt) {
  return new Set((alt || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((x) => x.length > 3 && !STOP.has(x)));
}
function tooSimilar(alt, existing) {
  const a = contentWords(alt);
  if (!a.size) return true; // təsvirsiz kadrı götürmürük
  for (const e of existing) {
    const b = contentWords(e.alt);
    if (!b.size) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    if (inter / (a.size + b.size - inter) > 0.45) return true;
  }
  return false;
}

const PEOPLE = /\b(man|woman|men|women|people|person|child|children|kid|boy|girl|family|guy|lady|group|crowd|team|couple|student|teacher|worker|chef|doctor|nurse|player)\b/i;
const ACTION = /\b(sitting|standing|walking|running|holding|working|cooking|eating|talking|playing|reading|writing|smiling|using|wearing|carrying|teaching|training|riding|shopping|cleaning|building)\b/i;
function score(p) {
  const alt = p.alt || '';
  let s = 0;
  if (PEOPLE.test(alt)) s += 3;
  if (ACTION.test(alt)) s += 2;
  if (alt.split(/\s+/).length >= 6) s += 1;
  return s;
}

async function search(query, key, page) {
  const url = 'https://api.pexels.com/v1/search?' + new URLSearchParams({
    query, per_page: '20', orientation: 'landscape', page: String(page),
  });
  const res = await fetch(url, { headers: { Authorization: key } });
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  return (await res.json()).photos || [];
}

(async () => {
  const key = apiKey();
  if (!key) { console.error('PEXELS_API_KEY tapılmadı'); process.exit(1); }
  const { target, days } = parseArgs();

  const topics = load();
  const phrases = readPhrases();

  // Bütün mövzulardakı id-lər — mövzular arası təkrarın qarşısını almaq üçün.
  const globalIds = new Set();
  for (const d of Object.keys(topics)) for (const im of topics[d]) globalIds.add(im.id);

  let list = Object.keys(topics).map(Number).sort((a, b) => a - b)
    .filter((d) => topics[d].length < target);
  if (days) list = list.filter((d) => days.includes(d));

  console.log(`Tamamlanacaq mövzu: ${list.length} (hədəf ${target})`);
  let added = 0, rateLimited = false;

  for (const day of list) {
    if (rateLimited) break;
    const imgs = topics[day];
    const need = target - imgs.length;
    const photographers = new Map();
    for (const im of imgs) photographers.set(im.credit, (photographers.get(im.credit) || 0) + 1);

    const found = [];
    // page 2-dən başlayırıq ki, ilk keçidin nəticələri təkrar gəlməsin.
    outer:
    for (const page of [2, 3]) {
      for (const phrase of (phrases[day] || [])) {
        if (found.length >= need) break outer;
        let photos;
        try {
          photos = await search(phrase, key, page);
        } catch (e) {
          if (e.message === 'RATE_LIMIT') { rateLimited = true; break outer; }
          continue;
        }
        photos.sort((a, b) => score(b) - score(a));
        for (const p of photos) {
          if (found.length >= need) break;
          const id = String(p.id);
          if (globalIds.has(id)) continue;
          if ((photographers.get(p.photographer) || 0) >= 2) continue;
          if (tooSimilar(p.alt, imgs.concat(found))) continue;
          globalIds.add(id);
          photographers.set(p.photographer, (photographers.get(p.photographer) || 0) + 1);
          found.push({
            id,
            url: p.src.large,
            fallbackUrl: p.src.medium,
            alt: p.alt || phrase,
            keywords: keywordsFromAlt(p.alt),
            prompts: [],
            credit: p.photographer,
            src: 'pexels',
          });
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    topics[day] = imgs.concat(found);
    added += found.length;
    console.log(`  day ${day}: +${found.length} → ${topics[day].length}`);
  }

  fs.writeFileSync(OUT, serialize(topics), 'utf8');
  console.log(`\nƏlavə olundu: ${added} kadr.` + (rateLimited ? ' (RATE LIMIT-ə düşdü, qalanı bir saatdan sonra)' : ''));
  console.log('Yeni kadrlar `reviewed` DEYİL — gözlə baxış lazımdır.');
})();
