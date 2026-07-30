// Mövzuya özəl "şəkli təsvir et" dəstlərini Openverse-dən qurur.
//
// İSTİFADƏ:
//   node scripts/generate_topic_images.js --days 1,3,9   # yalnız nümunə
//   node scripts/generate_topic_images.js                # bütün 30 mövzu
//   node scripts/generate_topic_images.js --dry          # yazma, yalnız çap et
//
// Mənbə: src/data/weeklyContent.js-dəki hər mövzunun imageKeywords massivi.
// Çıxış: src/data/topicImages.js (describeImages ilə eyni struktur).
//
// KEYFİYYƏT: Openverse çox zibil qaytarır (məhsul şəkilləri, illüstrasiya,
// hashtag spam). Ona görə: category=photograph, mature=false, və hər nəticə
// başlıq/teqlərdə sorğu sözlərinin neçəsini daşıdığına görə xallanır. Yenə də
// nəticə İDEAL DEYİL — bu, əl ilə baxış üçün ilk keçiddir, son söz deyil.
//
// AÇAR SÖZLƏR: Openverse teqləri (məs. "iphoneography") yararsızdır, ona görə
// açar sözlər sorğu ifadəsinin təsviredici sözlərindən çıxarılır (topic-səviyyə,
// şəkil-səviyyə deyil). describeImages-dəki əl yazısı qədər dəqiq deyil.

const fs = require('fs');
const path = require('path');

const WEEKLY = path.join(__dirname, '../src/data/weeklyContent.js');
const OUT = path.join(__dirname, '../src/data/topicImages.js');
const PER_TOPIC = 12;
const UA = 'SpeakLab/1.0 (english practice app; contact poladagayev90@gmail.com)';

const STOP = new Set(['a','an','the','of','in','on','at','to','and','with','for','busy','modern','fresh','happy','new','old','young','person','people']);

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { days: null, dry: a.includes('--dry') };
  const di = a.indexOf('--days');
  if (di >= 0 && a[di + 1]) out.days = a[di + 1].split(',').map(Number);
  return out;
}

// weeklyContent.js-i mətn kimi oxuyub hər mövzunun day + imageKeywords-unu çıxarır.
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

// Sorğu ifadəsindən şəkil-altı açar sözlər: stopwords atılır, unikal, maks 5.
function keywordsFromPhrase(phrase) {
  const words = phrase.toLowerCase().split(/\s+/).filter((w) => w && !STOP.has(w));
  return [...new Set(words)].slice(0, 5);
}

// Generic kamera/fayl adları təsvir edilə bilməz və mövzu ilə əlaqəsizdir:
// DSC_1234, DSCF0785, IMG_9, P8A7843, 220717161612, tək söz kodları və s.
function isJunkTitle(title) {
  const t = (title || '').trim();
  if (t.length < 4) return true;
  if (/^(dsc|dscf|dcim|img|imgp|pict|p\d|_mg|_dsc|gopr)/i.test(t)) return true;
  if (/^[0-9\s._-]+$/.test(t)) return true;               // yalnız rəqəm/simvol
  if (/^[a-z0-9]{6,}$/i.test(t.replace(/\s/g, ''))) return true; // boşluqsuz kod
  if ((t.match(/\d/g) || []).length > t.replace(/\s/g, '').length * 0.5) return true; // yarıdan çox rəqəm
  return false;
}

// İçində İNSAN/HƏRƏKƏT olan kadrlara üstünlük — şagird "kim nə edir" deyə
// danışsın. Boş obyekt/mənzərə (məs. boş traktor arabası) təsvir üçün zəifdir.
const PEOPLE = /\b(man|woman|men|women|people|person|child|children|kid|boy|girl|family|worker|player|student|teacher|chef|cook|crowd|team|group|couple|guy|lady|human|hands|face|portrait|passenger|commuter|customer|driver|dancer|singer|doctor|nurse|farmer|fisherman|barber|waiter|athlete|runner|swimmer|tourist)\b/;
// Təsvir edilə bilməyən kadrları cəzalandır: sxem, xəritə, loqo, mətn, sənəd.
const NON_DESCRIBABLE = /\b(map|diagram|chart|logo|icon|sign|text|document|poster|screenshot|template|infographic|flag|stamp|coin|label|barcode)\b/;

function scoreResult(r, phraseWords) {
  const title = (r.title || '').toLowerCase();
  const hay = (title + ' ' + (r.tags || []).map((t) => t.name).join(' ')).toLowerCase();
  let score = 0;
  for (const w of phraseWords) if (hay.includes(w)) score += 1;
  if (PEOPLE.test(hay)) score += 2;             // insan var → daha yaxşı təsvir
  if (NON_DESCRIBABLE.test(title)) score -= 2;  // sxem/xəritə/mətn → zəif
  // Uzun hashtag-spam başlıqlarını cəzalandır (Instagram zibili).
  if ((r.title || '').split('#').length > 4) score -= 2;
  return score;
}

// Near-duplicate açarı: eyni obyektin fərqli kadrları (məs. "'Hey' Wagon" /
// "'Hey' Wagon II") eyni açara düşsün deyə başlıqdan durğu, artikl və roman
// rəqəmləri (i, ii, iii…) atılır, ilk 2 mənalı söz açar olur.
const DEDUPE_DROP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']);
function dedupeKey(r) {
  const words = (r.title || '').toLowerCase()
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').filter((w) => w && !DEDUPE_DROP.has(w));
  return words.slice(0, 2).join(' ') || (r.creator || r.id);
}

async function searchOpenverse(phrase) {
  const url = 'https://api.openverse.org/v1/images/?' + new URLSearchParams({
    q: phrase,
    category: 'photograph',
    mature: 'false',
    page_size: '20',
    license_type: 'all',
  });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Openverse ${res.status} for "${phrase}"`);
  const json = await res.json();
  return json.results || [];
}

async function buildTopic(topic) {
  const chosen = [];
  const seen = new Set();
  const phraseWords = topic.phrases.map(keywordsFromPhrase);
  // Hər ifadə üçün iki dərəcə: əvvəl mövzuya UYĞUN (score>0) nəticələr, sonra
  // ehtiyat üçün score=0 amma junk OLMAYAN nəticələr. Junk (generic fayl adı)
  // heç vaxt götürülmür. Bu, 12-lik dəsti zəif-metadata mövzularda da doldurur.
  const pools = [];
  for (let i = 0; i < topic.phrases.length; i++) {
    // Openverse uzun ifadələrə (5-6 söz) demək olar heç nə qaytarmır — bütün
    // sözləri tələb edir. İlk 3 açar sözlə axtarırıq (çipdə tam siyahı qalır).
    const query = phraseWords[i].slice(0, 3).join(' ') || topic.phrases[i];
    const results = (await searchOpenverse(query))
      .filter((r) => r.id && r.thumbnail && !isJunkTitle(r.title))
      .map((r) => ({ r, s: scoreResult(r, phraseWords[i]) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s);
    pools.push({
      strong: results.filter((x) => x.s > 0).map((x) => x.r),
      weak: results.filter((x) => x.s === 0).map((x) => x.r),
      kw: phraseWords[i],
    });
    await new Promise((r) => setTimeout(r, 250)); // nəzakətli tempo
  }

  const seenKeys = new Set(); // near-duplicate başlıqları (eyni obyektin kadrları)
  const take = (tier) => {
    let idx = 0;
    let guard = 0;
    while (chosen.length < PER_TOPIC && guard < pools.length * 40) {
      guard++;
      const pool = pools[idx % pools.length];
      idx++;
      const r = pool[tier].shift();
      if (!r || seen.has(r.id)) continue;
      const key = dedupeKey(r);
      if (seenKeys.has(key)) continue; // eyni səhnənin təkrarı — at
      seen.add(r.id);
      seenKeys.add(key);
      chosen.push({
        id: r.id.slice(0, 8),
        url: r.thumbnail,
        fallbackUrl: r.url || '',
        alt: (r.title || 'Topic image').slice(0, 80),
        keywords: pool.kw,
      });
    }
  };
  take('strong');           // əvvəl uyğunlar
  if (chosen.length < PER_TOPIC) take('weak'); // sonra ehtiyat, 12-yə çatmaq üçün
  return chosen;
}

function serialize(map) {
  const header = fs.readFileSync(OUT, 'utf8').split('export const topicImages')[0];
  let body = 'export const topicImages = {\n';
  for (const day of Object.keys(map).map(Number).sort((a, b) => a - b)) {
    body += `  ${day}: [\n`;
    for (const img of map[day]) {
      body += '    ' + JSON.stringify(img) + ',\n';
    }
    body += '  ],\n';
  }
  body += '};\n\nexport default topicImages;\n';
  return header + body;
}

(async () => {
  const { days, dry } = parseArgs();
  let topics = readTopics();
  if (days) topics = topics.filter((t) => days.includes(t.day));
  console.log(`Building ${topics.length} topic(s): ${topics.map((t) => t.day).join(', ')}`);

  // Mövcud dəsti saxla ki, nümunə rejimi digər mövzuları silməsin.
  const existing = {};
  try {
    const src = fs.readFileSync(OUT, 'utf8');
    const re = /(\d+):\s*\[([\s\S]*?)\],?\n\s*(?=\d+:|\};)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      try { existing[Number(m[1])] = JSON.parse('[' + m[2] + ']'); } catch {}
    }
  } catch {}

  for (const t of topics) {
    process.stdout.write(`  day ${t.day}… `);
    try {
      const imgs = await buildTopic(t);
      existing[t.day] = imgs;
      console.log(`${imgs.length} images`);
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
