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
};

function loadKeywords(file) {
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(/"keywords":\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
    .concat([...src.matchAll(/keywords:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])));
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
  for (const [w, v] of Object.entries(OVERRIDES)) if (out[w]) out[w] = v;

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
