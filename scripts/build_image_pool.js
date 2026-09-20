// Faza 8 — şəkil hovuzu.
//
// scripts/image_scenes.json-dakı hər səhnə üçün Pexels-dən bir dəst kadr yığır
// və hamısını TƏK fayla yazır. Paylanma ayrıca skriptdədir
// (assign_topic_images.js), çünki paylanmanı dəfələrlə yenidən qurmaq lazım
// gəlir və hər dəfə API-ni yenidən döyəcləmək həm yavaşdır, həm də saatlıq
// limiti yandırır (Pexels: 200 sorğu/saat — 131 səhnə bir keçiddə sığır).
//
// İSTİFADƏ:
//   PEXELS_API_KEY=... node scripts/build_image_pool.js --out <fayl.json>
//   ... --scenes 0,5,9      # yalnız həmin indeksli səhnələr (təkrar cəhd üçün)
//   ... --resume            # mövcud fayldakı səhnələri atla
//
// Açar .env-dən də oxunur. DİQQƏT: REACT_APP_* OLMAMALIDIR — CRA onu bundle-a
// inline edər. Bu skript yalnız build-dən əvvəl əl ilə işlədilir.

const fs = require('fs');
const path = require('path');

const SCENES = path.join(__dirname, 'image_scenes.json');
const PER_SCENE = 30;

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { out: null, scenes: null, resume: a.includes('--resume') };
  const oi = a.indexOf('--out');
  if (oi >= 0 && a[oi + 1]) out.out = a[oi + 1];
  const si = a.indexOf('--scenes');
  if (si >= 0 && a[si + 1]) out.scenes = a[si + 1].split(',').map(Number);
  if (!out.out) throw new Error('--out <fayl.json> lazımdır');
  return out;
}

function apiKey() {
  if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY.trim();
  const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const m = env.match(/^\s*PEXELS_API_KEY\s*=\s*(.+)$/m);
  if (!m) throw new Error('PEXELS_API_KEY tapılmadı');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

// Təsvir üçün dəyər. `alt` Pexels-də kadrı təsvir edir ("Man in Black Jacket
// Sitting on Wooden Bench"), ona görə insan+hərəkət burada oxunur. Bu yalnız
// ÖN SIRALAMA-dır: son sözü kontakt-vərəqinə gözlə baxış deyir.
const PEOPLE = /\b(man|woman|men|women|people|person|child|children|kid|boy|girl|family|guy|lady|group|crowd|team|couple|student|teacher|worker|chef|doctor|nurse|player|friends)\b/i;
const ACTION = /\b(sitting|standing|walking|running|holding|working|cooking|eating|talking|playing|reading|writing|smiling|laughing|crying|using|wearing|carrying|teaching|training|riding|shopping|cleaning|building|jumping|dancing|waiting|repairing|selling)\b/i;
// Təsvir edilə bilməyən kadrlar: tək obyekt, fon, makro, çertyoj.
const DEAD = /\b(texture|pattern|background|wallpaper|abstract|closeup of a|flat lay|isolated|white background|mockup|logo|illustration|render)\b/i;

function score(p) {
  const alt = p.alt || '';
  let s = 0;
  if (PEOPLE.test(alt)) s += 3;
  if (ACTION.test(alt)) s += 2;
  if (DEAD.test(alt)) s -= 4;
  if (!alt.trim()) s -= 3;
  const words = alt.split(/\s+/).filter(Boolean).length;
  if (words >= 7) s += 2; else if (words >= 5) s += 1;
  return s;
}

async function searchPexels(query, key, page = 1) {
  const url = 'https://api.pexels.com/v1/search?' + new URLSearchParams({
    query,
    per_page: String(PER_SCENE),
    page: String(page),
    orientation: 'landscape',
  });
  const res = await fetch(url, { headers: { Authorization: key } });
  if (res.status === 429) throw new Error('Pexels saatlıq limiti — gözlə və --resume ilə davam et');
  if (!res.ok) throw new Error(`Pexels ${res.status} for "${query}"`);
  return (await res.json()).photos || [];
}

(async () => {
  const args = parseArgs();
  const key = apiKey();
  const { scenes } = JSON.parse(fs.readFileSync(SCENES, 'utf8'));

  let pool = {};
  if (args.resume && fs.existsSync(args.out)) pool = JSON.parse(fs.readFileSync(args.out, 'utf8'));

  const targets = scenes
    .map((s, i) => ({ ...s, i }))
    .filter((s) => (args.scenes ? args.scenes.includes(s.i) : true))
    .filter((s) => !(args.resume && pool[s.q]));

  console.log(`${targets.length} səhnə yığılacaq (cəmi ${scenes.length})`);
  let n = 0;
  for (const scene of targets) {
    try {
      const photos = await searchPexels(scene.q, key);
      pool[scene.q] = {
        tags: scene.tags,
        photos: photos
          .map((p) => ({
            id: String(p.id),
            url: p.src.large,          // 940×650 — kartın ölçüsü
            fallbackUrl: p.src.medium,
            alt: p.alt || '',
            credit: p.photographer || '',
            score: score(p),
          }))
          .sort((a, b) => b.score - a.score),
      };
      n += 1;
      if (n % 10 === 0) {
        fs.writeFileSync(args.out, JSON.stringify(pool));
        console.log(`  ${n}/${targets.length} …`);
      }
    } catch (e) {
      console.warn(`  XƏTA "${scene.q}": ${e.message}`);
      if (/limit/.test(e.message)) break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  fs.writeFileSync(args.out, JSON.stringify(pool));
  const total = Object.values(pool).reduce((t, s) => t + s.photos.length, 0);
  console.log(`hovuz: ${Object.keys(pool).length} səhnə, ${total} kadr → ${args.out}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
