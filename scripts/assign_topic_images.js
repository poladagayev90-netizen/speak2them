// Faza 8 — hovuzdan 60 mövzuya paylanma.
//
// QAYDA (Polad, 2026-09-20): şəkillər mövzunun illüstrasiyası DEYİL. Hər
// mövzuda bir neçə kadr mövzuya yaxın olur, qalanı tamam başqa hadisə göstərir.
// Səbəb: "Books & Reading" mövzusunda 12 nəfərin kitab oxuduğu kadr təsvir
// məşğələsini öldürür — şagird 12 dəfə eyni cümləni qurur. Müxtəliflik həm
// lüğəti genişləndirir, həm də "burada nə baş verir?" sualını canlı saxlayır.
//
// İSTİFADƏ:
//   node scripts/assign_topic_images.js --pool <hovuz.json>
//   ... --dry      # yazma, yalnız statistika
//
// Paylanma DETERMİNİSTİKDİR (mulberry32 seed) — eyni hovuzla eyni nəticə çıxır,
// yəni backfill-dən sonra təkrar işlətmək dəsti qarışdırmır.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../src/data/topicImages.js');
const PER_TOPIC = 12;
const NEAR_TOPIC = 5;          // mövzuya yaxın səhnələrdən neçə kadr
const MAX_PER_SCENE_IN_TOPIC = 2;
const MAX_PER_SCENE_TOTAL = 9;  // 720 / 132 ≈ 5.5 — tavan bir səhnənin dəsti udmasını saxlayır
const MAX_PER_PHOTOGRAPHER_IN_TOPIC = 2;
const SEED = 20260920;

// Mövzu → səhnə teqləri. Yalnız "yaxın" beşliyi seçmək üçündür; qalan yeddi
// kadr bu teqlərdən KƏNAR səhnələrdən gəlir.
const TOPIC_TAGS = {
  1: ['travel', 'crowd'], 2: ['tech', 'work'], 3: ['food', 'market'], 4: ['study', 'child'],
  5: ['health', 'sport'], 6: ['weather', 'farm', 'water'], 7: ['work', 'emotion'], 8: ['tech', 'emotion'],
  9: ['market', 'work'], 10: ['art', 'night'], 11: ['music', 'celebration'], 12: ['crowd', 'news'],
  13: ['craft', 'game', 'sport'], 14: ['fashion', 'market'], 15: ['art', 'child'], 16: ['emotion', 'risk'],
  17: ['emotion', 'friends'], 18: ['sport', 'crowd'], 19: ['animal', 'farm'], 20: ['culture', 'celebration'],
  21: ['tech', 'study'], 22: ['street', 'farm'], 23: ['study', 'solitude'], 24: ['emotion', 'friends'],
  25: ['market', 'crowd'], 26: ['work', 'emotion'], 27: ['old', 'culture'], 28: ['tech', 'change'],
  29: ['family', 'home'], 30: ['celebration', 'family'], 31: ['community', 'home'], 32: ['weather'],
  33: ['commute', 'vehicle'], 34: ['food', 'home'], 35: ['child', 'family'], 36: ['work'],
  37: ['emotion', 'conflict'], 38: ['game', 'emotion'], 39: ['rules', 'street'], 40: ['repair', 'craft'],
  41: ['crowd', 'street'], 42: ['solitude', 'night'], 43: ['game', 'child'], 44: ['celebration', 'community'],
  45: ['health', 'risk'], 46: ['community', 'emotion'], 47: ['celebration', 'culture'], 48: ['market', 'street'],
  49: ['water'], 50: ['night', 'work'], 51: ['elder', 'family'], 52: ['change', 'home'],
  53: ['craft', 'art'], 54: ['news', 'crowd'], 55: ['risk', 'sport'], 56: ['farm', 'food'],
  57: ['old', 'market'], 58: ['art'], 59: ['home', 'conflict'], 60: ['travel', 'emotion'],
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'and', 'with', 'for', 'from',
  'near', 'beside', 'front', 'while', 'during', 'his', 'her', 'their', 'photo', 'image', 'shot',
  'view', 'closeup', 'close', 'up', 'standing', 'sitting']);

// Başlanğıc açar sözlər — yalnız DÖŞƏMƏdir. Son sözü kontakt-vərəqinə gözlə
// baxış yazır (apply_image_review.js), ona görə `reviewed: false` qoyulur.
function keywordsFromAlt(alt) {
  const words = String(alt || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(words)].slice(0, 5);
}

const args = process.argv.slice(2);
const poolPath = args[args.indexOf('--pool') + 1];
const dry = args.includes('--dry');
if (!poolPath) throw new Error('--pool <hovuz.json> lazımdır');

const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
const scenes = Object.entries(pool).map(([q, v]) => ({ q, tags: v.tags, photos: v.photos }));
const rand = mulberry32(SEED);
const usedPhoto = new Set();
const sceneTotal = new Map();

// Bir səhnədən növbəti ən yaxşı (hələ işlənməmiş) kadr.
function take(scene, topicSceneCount, topicPhotographers) {
  if ((sceneTotal.get(scene.q) || 0) >= MAX_PER_SCENE_TOTAL) return null;
  if ((topicSceneCount.get(scene.q) || 0) >= MAX_PER_SCENE_IN_TOPIC) return null;
  for (const p of scene.photos) {
    if (usedPhoto.has(p.id)) continue;
    if ((topicPhotographers.get(p.credit) || 0) >= MAX_PER_PHOTOGRAPHER_IN_TOPIC) continue;
    usedPhoto.add(p.id);
    sceneTotal.set(scene.q, (sceneTotal.get(scene.q) || 0) + 1);
    topicSceneCount.set(scene.q, (topicSceneCount.get(scene.q) || 0) + 1);
    topicPhotographers.set(p.credit, (topicPhotographers.get(p.credit) || 0) + 1);
    return { ...p, scene: scene.q };
  }
  return null;
}

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const result = {};
const stats = [];
for (let day = 1; day <= 60; day++) {
  const tags = TOPIC_TAGS[day] || [];
  const near = shuffled(scenes.filter((s) => s.tags.some((t) => tags.includes(t))));
  const far = shuffled(scenes.filter((s) => !s.tags.some((t) => tags.includes(t))));
  const chosen = [];
  const topicSceneCount = new Map();
  const topicPhotographers = new Map();

  // Mövzuya yaxın beşlik, sonra uzaq yeddilik. Hər iki keçid səhnələr arasında
  // növbə ilə gedir — bir səhnədən ardıcıl iki kadr götürüb qalanını atlamasın.
  const fill = (list, limit) => {
    let guard = 0;
    while (chosen.length < limit && guard < list.length * MAX_PER_SCENE_IN_TOPIC + 5) {
      let progress = false;
      for (const scene of list) {
        if (chosen.length >= limit) break;
        const p = take(scene, topicSceneCount, topicPhotographers);
        if (p) { chosen.push(p); progress = true; }
      }
      if (!progress) break;
      guard += 1;
    }
  };
  fill(near, Math.min(NEAR_TOPIC, PER_TOPIC));
  fill(far, PER_TOPIC);
  fill([...near, ...far], PER_TOPIC); // qalan boşluq (nadir hal)

  result[day] = chosen.map((p) => ({
    id: p.id,
    url: p.url,
    fallbackUrl: p.fallbackUrl,
    alt: p.alt,
    keywords: keywordsFromAlt(p.alt),
    prompts: [],
    credit: p.credit,
    scene: p.scene,
    src: 'pexels',
    reviewed: false,
  }));
  stats.push({ day, got: chosen.length, scenes: new Set(chosen.map((c) => c.scene)).size });
}

const short = stats.filter((s) => s.got < PER_TOPIC);
console.log('mövzu:', stats.length, '| kadr:', stats.reduce((n, s) => n + s.got, 0));
console.log('mövzu başına fərqli səhnə: min', Math.min(...stats.map((s) => s.scenes)), 'orta',
  (stats.reduce((n, s) => n + s.scenes, 0) / stats.length).toFixed(1));
console.log('natamam mövzular:', short.length ? short : 'yoxdur');
console.log('ən çox işlənən səhnələr:', [...sceneTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5));

if (dry) process.exit(0);

const header = `// Mövzuya bağlı "şəkli təsvir et" dəstləri — hər mövzu (day 1..60) üçün 12 kadr.
//
// ŞƏKİLLƏR MÖVZUNUN İLLÜSTRASİYASI DEYİL (Faza 8 qaydası). Hər dəstdə ~5 kadr
// mövzuya yaxın səhnədən, ~7 kadr TAMAM BAŞQA hadisədən gəlir. Əvvəlki dəst
// mövzu adından qurulurdu və "Books & Reading"-də 12 nəfər kitab oxuyurdu —
// şagird 12 dəfə eyni cümləni deyirdi. Seçim meyarı: kadrda KONKRET AN, canlı
// emosiya və danışmağa dəyən detal olsun.
//
// Struktur describeImages.js ilə eynidir:
//   { id, url, fallbackUrl, alt, keywords: [...], prompts: [...], credit, scene, reviewed }
//
// SİNXRON QORUNUR: URL-lər burada DONDURULUB (runtime sorğu yoxdur), siyahı
// statik və deterministikdir — zəngdə iki tərəf həmişə eyni şəkli eyni sırada
// görür (indeks call sənədindəki imageStage ilə sinxronlanır).
//
// AÇAR SÖZ SAYI: hər şəkildə MAKSİMUM 5. Söz sayı birbaşa şagirdin nə qədər
// danışmalı olduğunu təyin edir; altıncı söz həmişə ya sinonim olurdu, ya da
// kadr haqqında ("close-up"), şəkil haqqında yox. Şəkildə GÖRÜNƏN şeyi yaz.
//
// \`reviewed: false\` = açar sözlər hələ \`alt\` mətnindən avtomatik çıxarılıb və
// kadra gözlə baxılmayıb. Vərəqə baxıb apply_image_review.js ilə yenilə.
//
// Qurulur: scripts/build_image_pool.js → scripts/assign_topic_images.js
export const topicImages = {
`;

const body = Object.entries(result)
  .map(([day, list]) => `  ${day}: [\n${list.map((p) => '    ' + JSON.stringify(p) + ',').join('\n')}\n  ],`)
  .join('\n');

fs.writeFileSync(OUT, header + body + '\n};\n');
console.log('yazıldı →', OUT);
