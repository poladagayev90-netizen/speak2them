// Şəkil açar sözlərinin lüğətini qurur → src/data/keywordGlossary.js
//
// NİYƏ LAZIMDIR: şəklin altındakı sözlər şagirdə "bunları işlət" deyir, amma
// A2 səviyyəsində sözün özü anlaşılmaya bilər. Üstünə BİR DƏFƏ basanda tərcümə
// görünür (KeywordChips). Tərcümə dili — öyrənənin L1-i (users.preferredLanguage,
// analiz hesabatı ilə eyni mənbə), telefonun sistem dili DEYİL: sistem dili rus
// və ya ingilis olanda tərcümə ümumiyyətlə olmazdı.
//
// NİYƏ RUNTIME DEYİL: 720 şəkil × 5 söz = 3600 istifadə, amma unikal söz çox
// azdır. Build vaxtı bir dəfə tərcümə edib fayla yazmaq = sıfır gecikmə, sıfır
// xərc, oflayn işləyir və nəticə hamıda eynidir.
//
// İSTİFADƏ:
//   node scripts/build_keyword_glossary.js            # çatışmayanları tərcümə et
//   node scripts/build_keyword_glossary.js --rebuild  # hamısını yenidən
//
// Maşın tərcüməsi tək sözdə çoxmənalılıqda səhv edir ("spring", "bank"). Ona
// görə OVERRIDES əl ilə yazılır və maşın nəticəsini həmişə üstələyir.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../src/data/keywordGlossary.js');
const SOURCES = [
  path.join(__dirname, '../src/data/topicImages.js'),
  path.join(__dirname, '../src/data/describeImages.js'),
  path.join(__dirname, '../src/data/describeVideos.js'),
];

// Kontekstdən asılı sözlər — şəkil altındakı mənası ilə.
const OVERRIDES = {
  'bank': { az: 'çay sahili', tr: 'nehir kıyısı' },
  'spring': { az: 'yaz', tr: 'ilkbahar' },
  'light': { az: 'işıq', tr: 'ışık' },
  'kind': { az: 'mehriban', tr: 'nazik' },
  'still': { az: 'sakit', tr: 'durgun' },
  'watch': { az: 'qol saatı', tr: 'kol saati' },
  'match': { az: 'oyun', tr: 'maç' },
  'crane': { az: 'kran', tr: 'vinç' },
  'trunk': { az: 'ağac gövdəsi', tr: 'ağaç gövdesi' },
  'court': { az: 'meydança', tr: 'saha' },
  'fair': { az: 'yarmarka', tr: 'panayır' },
  'stall': { az: 'bazar piştaxtası', tr: 'pazar tezgâhı' },
  'change': { az: 'xırda pul', tr: 'bozuk para' },
  'plate': { az: 'boşqab', tr: 'tabak' },
  'pitch': { az: 'futbol meydançası', tr: 'futbol sahası' },
  // Şəkil altında yanlış çıxan maşın tərcümələri (2026-09-20 gözlə yoxlama).
  'close up': { az: 'yaxın plan', tr: 'yakın çekim' },
  'toasting': { az: 'sağlıq deyir', tr: 'kadeh kaldırma' },
  'notebook': { az: 'dəftər', tr: 'not defteri' },
  'cap': { az: 'kepka', tr: 'kasket' },
  'leaning': { az: 'söykənmiş', tr: 'yaslanmış' },
  'packing': { az: 'çamadan yığır', tr: 'bavul hazırlıyor' },
  'moving': { az: 'daşınma', tr: 'taşınma' },
  'black and white': { az: 'ağ-qara', tr: 'siyah beyaz' },
  'friends': { az: 'dostlar', tr: 'arkadaşlar' },
  'counter': { az: 'piştaxta', tr: 'tezgâh' },
  'steps': { az: 'pilləkən', tr: 'basamaklar' },
  'field': { az: 'tarla', tr: 'tarla' },
  'platform': { az: 'perron', tr: 'peron' },
  'rooftop': { az: 'dam', tr: 'çatı' },
  'bus shelter': { az: 'avtobus dayanacağı', tr: 'otobüs durağı' },
  'wooden jetty': { az: 'taxta körpü', tr: 'ahşap iskele' },
  'sleeping': { az: 'yatıb', tr: 'uyuyor' },
  'waiting': { az: 'gözləyir', tr: 'bekliyor' },
  'thinking': { az: 'fikirləşir', tr: 'düşünüyor' },
  'holding': { az: 'tutub', tr: 'tutuyor' },
  'standing': { az: 'ayaq üstə', tr: 'ayakta' },
  'serving': { az: 'süfrəyə verir', tr: 'servis yapıyor' },
  'scales': { az: 'tərəzi', tr: 'terazi' },
  // Video dəsti (describeVideos.js) — hamısı ƏL İLƏ yazılıb: bu sözlərin çoxu
  // söz birləşməsidir və maşın onları hərfi tərcümə edir ("open palm" →
  // "açıq xurma", yəni palma meyvəsi).
  'open palm': { az: 'açıq ovuc', tr: 'açık avuç' },
  'standing still': { az: 'tərpənmədən dayanıb', tr: 'kıpırdamadan duruyor' },
  'blanket': { az: 'ədyal', tr: 'battaniye' },
  'falling': { az: 'aşağı düşür', tr: 'düşüyor' },
  'soaked': { az: 'başdan-ayağa islanıb', tr: 'sırılsıklam' },
  'rooster': { az: 'xoruz', tr: 'horoz' },
  'vegetable patch': { az: 'tərəvəz ləki', tr: 'sebze bahçesi' },
  'cross-legged': { az: 'bardaş qurub', tr: 'bağdaş kurmuş' },
  'rope swing': { az: 'kəndir yelləncək', tr: 'ip salıncak' },
  'pond': { az: 'gölməçə', tr: 'gölet' },
  'let go': { az: 'əlini buraxmaq', tr: 'bırakmak' },
  'splash': { az: 'suyun sıçraması', tr: 'su sıçraması' },
  'reeds': { az: 'qamışlıq', tr: 'sazlık' },
  'gorilla': { az: 'qorilla', tr: 'goril' },
  'chewing leaves': { az: 'yarpaq çeynəyir', tr: 'yaprak çiğniyor' },
  'bird feeder': { az: 'quş yemliyi', tr: 'kuş yemliği' },
  'squirrel': { az: 'dələ', tr: 'sincap' },
  'dove': { az: 'göyərçin', tr: 'güvercin' },
  'seeds': { az: 'dən', tr: 'yem tanesi' },
  'deer': { az: 'maral', tr: 'geyik' },
  'estate agent': { az: 'əmlak agenti', tr: 'emlakçı' },
  'staircase': { az: 'pilləkən', tr: 'merdiven' },
  'carpet': { az: 'xalça', tr: 'halı' },
  'slip': { az: 'sürüşmək', tr: 'kaymak' },
  'empty house': { az: 'boş ev', tr: 'boş ev' },
  'hen': { az: 'toyuq', tr: 'tavuk' },
  'stroke': { az: 'sığallamaq', tr: 'okşamak' },
  'feathers': { az: 'lələklər', tr: 'tüyler' },
  'kangaroo': { az: 'kenquru', tr: 'kanguru' },
  'stand upright': { az: 'dik dayanmaq', tr: 'dik durmak' },
  'muscles': { az: 'əzələlər', tr: 'kaslar' },
  'stare': { az: 'gözünü zilləmək', tr: 'dik dik bakmak' },
  'white birds': { az: 'ağ quşlar', tr: 'beyaz kuşlar' },
  'treeline': { az: 'meşənin kənarı', tr: 'ağaç sınırı' },
  'leopard': { az: 'bəbir', tr: 'leopar' },
  'dirt track': { az: 'torpaq yol', tr: 'toprak yol' },
  'safari vehicle': { az: 'safari maşını', tr: 'safari aracı' },
  'dry grass': { az: 'quru ot', tr: 'kuru ot' },
  'spots': { az: 'xallar', tr: 'benekler' },
  'huge knife': { az: 'nəhəng bıçaq', tr: 'kocaman bıçak' },
  'flatbread': { az: 'yastı çörək', tr: 'yassı ekmek' },
  'salads': { az: 'salatlar', tr: 'salatalar' },
  'pier': { az: 'taxta körpü', tr: 'iskele' },
  'big fish': { az: 'iri balıq', tr: 'büyük balık' },
  'put back': { az: 'geri qoymaq', tr: 'geri koymak' },
  'lose balance': { az: 'müvazinətini itirmək', tr: 'dengesini kaybetmek' },
  'eagle': { az: 'qartal', tr: 'kartal' },
  'spread wings': { az: 'qanadlarını açmaq', tr: 'kanatlarını açmak' },
  'mound': { az: 'torpaq təpəciyi', tr: 'toprak tümsek' },
  'open field': { az: 'açıq sahə', tr: 'açık arazi' },
  'take off': { az: 'uçub qalxmaq', tr: 'havalanmak' },
  'wipers': { az: 'şüşəsilənlər', tr: 'silecekler' },
  'city below': { az: 'aşağıdakı şəhər', tr: 'aşağıdaki şehir' },
  'wake up': { az: 'oyanmaq', tr: 'uyanmak' },
  'news studio': { az: 'xəbər studiyası', tr: 'haber stüdyosu' },
  'presenter': { az: 'aparıcı', tr: 'sunucu' },
  'crawl': { az: 'sürünmək', tr: 'sürünmek' },
  'live tv': { az: 'canlı efir', tr: 'canlı yayın' },
  'screen': { az: 'ekran', tr: 'ekran' },
  'canal': { az: 'su arxı', tr: 'sulama kanalı' },
  'rice field': { az: 'çəltik tarlası', tr: 'pirinç tarlası' },
  'toy boat': { az: 'oyuncaq qayıq', tr: 'oyuncak tekne' },
  'current': { az: 'suyun axını', tr: 'akıntı' },
};

function loadKeywords(file) {
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(/"keywords":\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
    .concat([...src.matchAll(/keywords:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])));
}

async function translate(text, target) {
  const url = 'https://translate.googleapis.com/translate_a/single?'
    + new URLSearchParams({ client: 'gtx', sl: 'en', tl: target, dt: 't', q: text });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const json = await res.json();
  return json[0].map((x) => x[0]).join('').trim();
}

(async () => {
  const rebuild = process.argv.includes('--rebuild');
  const words = [...new Set(SOURCES.flatMap(loadKeywords).map((w) => w.trim().toLowerCase()))]
    .filter((w) => w && w.length <= 40)
    .sort();

  let existing = {};
  if (!rebuild && fs.existsSync(OUT)) {
    const src = fs.readFileSync(OUT, 'utf8');
    const m = src.match(/export const keywordGlossary = (\{[\s\S]*?\});/);
    if (m) existing = JSON.parse(m[1]);
  }

  const todo = words.filter((w) => !existing[w]);
  console.log(`unikal söz: ${words.length}, tərcümə lazım: ${todo.length}`);

  const out = { ...existing };
  let n = 0;
  for (const w of todo) {
    try {
      const az = await translate(w, 'az');
      const tr = await translate(w, 'tr');
      out[w] = { az, tr };
    } catch (e) {
      console.warn(`  XƏTA "${w}": ${e.message}`);
    }
    n += 1;
    if (n % 100 === 0) console.log(`  ${n}/${todo.length} …`);
    await new Promise((r) => setTimeout(r, 60));
  }

  // Əl ilə yazılanlar maşını həmişə üstələyir.
  const wanted = new Set(words);
  for (const [w, v] of Object.entries(OVERRIDES)) if (out[w] || wanted.has(w)) out[w] = v;

  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
  const header = `// Şəkil açar sözlərinin lüğəti — söz → { az, tr }.
//
// Şəklin altındakı sözə bir dəfə basanda öyrənənin öz dilindəki qarşılığı
// görünür (KeywordChips). Dil users.preferredLanguage-dən gəlir — analiz
// hesabatı ilə eyni mənbə; telefonun sistem dili İŞLƏNMİR, çünki sistem dili
// rus/ingilis olan telefonda tərcümə heç vaxt görünməzdi.
//
// Bu fayl scripts/build_keyword_glossary.js tərəfindən qurulur. Tək sözün
// maşın tərcüməsi çoxmənalılıqda səhv edir ("bank", "spring") — həmin sözlər
// skriptdəki OVERRIDES-də əl ilə yazılıb və maşını üstələyir. Yeni söz əlavə
// edəndə skripti yenidən işlət: mövcud tərcümələr saxlanılır, yalnız çatışmayan
// sözlər sorğulanır.

export const keywordGlossary = `;
  fs.writeFileSync(OUT, header + JSON.stringify(sorted, null, 0) + ';\n');
  console.log(`lüğət: ${Object.keys(sorted).length} söz → ${OUT}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
