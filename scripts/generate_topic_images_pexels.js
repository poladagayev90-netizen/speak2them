// Mövzuya özəl "şəkli təsvir et" dəstlərini PEXELS-dən qurur.
//
// NİYƏ OPENVERSE-İ ƏVƏZ EDİR: Openverse Flickr/muzey CC arxividir — orada
// "adamlar nəsə edir" tipli aydın gündəlik kadr azdır, mənzərə/sənəd/afişa
// çoxdur. Ölçülmüş nəticə: 30 mövzuda cəmi 4.3 fərqli açar-söz dəsti, 25
// mövzuda ən azı 4 şəkil eyni dəsti daşıyırdı, mövzu 1-də 12 kadrdan yalnız 3-ü
// təsvir üçün yararlı idi (qalanı boş dağ mənzərəsi, gəmi afişası, traktor
// kollajı). Pexels korpusu məhz insan+hərəkət kadrlarından ibarətdir və
// lisenziyası atribusiya tələb etmir (Openverse CC-BY tələb edirdi).
//
// İSTİFADƏ:
//   PEXELS_API_KEY=... node scripts/generate_topic_images_pexels.js --days 1,2
//   PEXELS_API_KEY=... node scripts/generate_topic_images_pexels.js --all
//   ... --dry     # yazma, yalnız çap et
//
// Açar `.env`-dən də oxunur. DİQQƏT: adı REACT_APP_* OLMAMALIDIR — CRA bütün
// REACT_APP_* dəyişənlərini brauzer bundle-ına inline edir, yəni açar sızardı.
// Bu skript yalnız build-dən əvvəl, əl ilə işlədilir; runtime sorğu yoxdur.

const fs = require('fs');
const path = require('path');

const WEEKLY = path.join(__dirname, '../src/data/weeklyContent.js');
const OUT = path.join(__dirname, '../src/data/topicImages.js');
const PER_TOPIC = 12;

// ƏSAS DÜZƏLİŞ: bir ifadədən maksimum bu qədər şəkil götürülür. Köhnə skriptdə
// belə limit YOX idi — hovuzlar arasında növbə ilə gəzirdi, amma bir hovuz
// boşalanda qalan dolu hovuzdan çəkməyə davam edirdi. Nəticə: mövzu 2-də 12
// şəkildən 8-i eyni "virtual reality headset" sorğusundan gəlmişdi. 5 ifadə ×
// 3 = 15 ≥ 12, yəni limit qoysaq da dəst dolur.
const MAX_PER_PHRASE = 3;

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { days: null, all: a.includes('--all'), dry: a.includes('--dry') };
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
  } catch { /* .env yoxdur */ }
  return null;
}

function readTopics() {
  const src = fs.readFileSync(WEEKLY, 'utf8');
  const topics = [];
  const re = /day:\s*(\d+),[\s\S]*?imageKeywords:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const day = Number(m[1]);
    const phrases = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (phrases.length) topics.push({ day, phrases });
  }
  return topics;
}

// Pexels `alt` sahəsi Openverse başlığından qat-qat yaxşıdır — kadrı təsvir edir
// ("Man in Black Jacket Sitting on Wooden Bench"), fayl adı deyil. Yenə də bu
// AVTOMATİK açar sözlərdir: dəst pozulmasın deyə döşəmə rolu oynayır, son sözü
// gözlə baxış yazır (aşağıdakı `reviewed` bayrağına bax).
const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'and', 'with', 'for',
  'near', 'beside', 'front', 'while', 'during', 'his', 'her', 'their', 'wearing', 'holding',
  'photo', 'image', 'shot', 'view', 'closeup', 'close', 'up', 'white', 'black', 'blue', 'red',
  'green', 'gray', 'grey', 'brown']);

function keywordsFromAlt(alt) {
  const words = (alt || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(words)].slice(0, 5);
}

// Eyni çəkilişin bir neçə kadrı (eyni fotoqraf, oxşar təsvir) dəstə düşməsin.
function contentWords(alt) {
  return new Set((alt || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w)));
}
function tooSimilar(alt, chosen) {
  const a = contentWords(alt);
  if (!a.size) return false;
  for (const c of chosen) {
    const b = contentWords(c.alt);
    if (!b.size) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    const jaccard = inter / (a.size + b.size - inter);
    if (jaccard > 0.5) return true;
  }
  return false;
}

// Təsvir üçün dəyər: insan/hərəkət olan kadr yaxşıdır, tək obyekt/fon zəifdir.
const PEOPLE = /\b(man|woman|men|women|people|person|child|children|kid|boy|girl|family|guy|lady|group|crowd|team|couple|student|teacher|worker|chef|doctor|nurse|player)\b/i;
const ACTION = /\b(sitting|standing|walking|running|holding|working|cooking|eating|talking|playing|reading|writing|smiling|using|wearing|carrying|teaching|training|riding|shopping|cleaning|building)\b/i;

function score(photo) {
  const alt = photo.alt || '';
  let s = 0;
  if (PEOPLE.test(alt)) s += 3;
  if (ACTION.test(alt)) s += 2;
  if (!alt.trim()) s -= 3;              // təsvirsiz kadr — nə olduğunu bilmirik
  if (alt.split(/\s+/).length >= 6) s += 1; // zəngin təsvir = zəngin kadr
  return s;
}

async function searchPexels(query, key) {
  const url = 'https://api.pexels.com/v1/search?' + new URLSearchParams({
    query,
    per_page: '20',
    orientation: 'landscape', // 230px hündürlüyündə karta yaxşı oturur
  });
  const res = await fetch(url, { headers: { Authorization: key } });
  if (res.status === 429) throw new Error('Pexels rate limit (200/saat) — bir az gözlə');
  if (!res.ok) throw new Error(`Pexels ${res.status} for "${query}"`);
  const json = await res.json();
  return json.photos || [];
}

async function buildTopic(topic, key) {
  const chosen = [];
  const seenIds = new Set();
  const seenPhotographers = new Map(); // eyni fotoqrafdan 2-dən çox götürmə

  // Hər ifadə üçün ayrıca hovuz — sonra HƏR BİRİNDƏN ən çox MAX_PER_PHRASE.
  const pools = [];
  for (const phrase of topic.phrases) {
    const photos = (await searchPexels(phrase, key))
      .map((p) => ({ p, s: score(p) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
    pools.push({ phrase, photos });
    await new Promise((r) => setTimeout(r, 200)); // nəzakətli tempo
  }

  // Növbə ilə, amma hovuz başına sərt limitlə. Limit dolubsa hovuz atlanır —
  // köhnə skriptin səhvi məhz burada idi (limit yox idi, bir hovuz dəsti udurdu).
  const takenFrom = new Array(pools.length).fill(0);
  let round = 0;
  while (chosen.length < PER_TOPIC && round < MAX_PER_PHRASE) {
    for (let i = 0; i < pools.length && chosen.length < PER_TOPIC; i++) {
      if (takenFrom[i] >= MAX_PER_PHRASE) continue;
      const pool = pools[i];
      while (pool.photos.length) {
        const p = pool.photos.shift();
        if (seenIds.has(p.id)) continue;
        if ((seenPhotographers.get(p.photographer) || 0) >= 2) continue;
        if (tooSimilar(p.alt, chosen)) continue;
        seenIds.add(p.id);
        seenPhotographers.set(p.photographer, (seenPhotographers.get(p.photographer) || 0) + 1);
        takenFrom[i]++;
        chosen.push({
          id: String(p.id),
          url: p.src.large,
          fallbackUrl: p.src.medium,   // EYNİ fotonun başqa ölçüsü — sinxron pozulmur
          alt: p.alt || topic.phrases[i],
          keywords: keywordsFromAlt(p.alt),
          prompts: [],
          credit: p.photographer,
          src: 'pexels',
        });
        break;
      }
    }
    round++;
  }
  return chosen;
}

// Mövcud faylı oxu — gözlə baxışdan keçmiş (`reviewed: true`) girişlər QORUNUR,
// yoxsa skriptin hər işə düşməsi əl ilə yazılmış lüğəti silərdi.
function readExisting() {
  const existing = {};
  try {
    let src = fs.readFileSync(OUT, 'utf8')
      .replace(/export const topicImages =/, 'module.exports =')
      .replace(/export default topicImages;?/, '');
    const tmp = path.join(require('os').tmpdir(), `ti-read-${Date.now()}.js`);
    fs.writeFileSync(tmp, src, 'utf8');
    Object.assign(existing, require(tmp));
    fs.unlinkSync(tmp);
  } catch (e) {
    console.log('  (mövcud fayl oxunmadı, sıfırdan qurulur:', e.message + ')');
  }
  return existing;
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

(async () => {
  const key = apiKey();
  if (!key) {
    console.error('PEXELS_API_KEY tapılmadı. .env-ə əlavə et və ya mühit dəyişəni kimi ver.');
    console.error('Açar: https://www.pexels.com/api/  (pulsuz, kart tələb etmir)');
    process.exit(1);
  }

  const { days, all, dry } = parseArgs();
  let topics = readTopics();
  if (!all && days) topics = topics.filter((t) => days.includes(t.day));
  if (!all && !days) { console.error('--days 1,2 və ya --all ver'); process.exit(1); }

  const existing = readExisting();
  console.log(`Building ${topics.length} topic(s) from Pexels…`);

  for (const t of topics) {
    // Gözlə baxılmış mövzuya toxunma.
    if ((existing[t.day] || []).some((im) => im.reviewed)) {
      console.log(`  day ${t.day}… ATLANDI (reviewed)`);
      continue;
    }
    process.stdout.write(`  day ${t.day}… `);
    try {
      const imgs = await buildTopic(t, key);
      existing[t.day] = imgs;
      console.log(`${imgs.length} şəkil`);
      if (dry) imgs.forEach((im) => console.log(`      [${im.keywords.join(', ')}]  ${im.alt}`));
    } catch (e) {
      console.log('FAILED:', e.message);
    }
  }

  if (!dry) {
    fs.writeFileSync(OUT, serialize(existing), 'utf8');
    console.log(`Wrote ${OUT}`);
  } else {
    console.log('(dry run — nothing written)');
  }
})();
