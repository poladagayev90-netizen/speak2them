// Klipləri 60 mövzuya paylayır → src/data/topicVideos.js
//
// NİYƏ LAZIMDIR: şagird eyni klipi təkrar-təkrar görməsin. Əvvəl hər mövzu
// paylaşılan siyahının üzərində sadə PƏNCƏRƏ idi (mövzu 1 → 1-6, mövzu 2 →
// 7-12); pəncərə dekanın sonuna çatanda başa qayıdırdı, yəni uzaq mövzular
// eyni altılığı alırdı. Bu skript paylanmanı AÇIQ fayla yazır: hansı mövzuda
// hansı klip var — görünür, əl ilə düzəldilə bilər, və deka böyüdükcə
// yenidən işlədilir.
//
// QAYDA (şəkil dəstindən gəlir): klip mövzunun İLLÜSTRASİYASI deyil. Mövzu
// "Books & Reading" olanda altı nəfərin kitab oxuduğu klip təsviri öldürür —
// şagird altı dəfə eyni cümləni qurur. Ona görə paylanma mövzu MƏTNİNƏ
// baxmır; yeganə məqsəd təkrarı azaltmaqdır.
//
// ALQORİTM (ən az işlənmiş, ən çoxdan işlənmiş): hər mövzuya klipləri
// (istifadə sayı ↑, son işlənən mövzu ↑) sırası ilə verir və ƏVVƏLKİ mövzuda
// işlənən klipi mümkün olduqca atlayır. Deka ≥ 12 olanda qonşu iki mövzu
// TAM ayrılır. Deterministikdir — eyni deka, eyni nəticə.
//
// İSTİFADƏ:
//   node scripts/assign_topic_videos.js          # yaz
//   node scripts/assign_topic_videos.js --dry    # yalnız statistika

const fs = require('fs');
const path = require('path');

const DECK = path.join(__dirname, '../src/data/describeVideos.js');
const CONTENT = path.join(__dirname, '../src/data/weeklyContent.js');
const OUT = path.join(__dirname, '../src/data/topicVideos.js');
const PER_TOPIC = 6;

function readIds() {
  const src = fs.readFileSync(DECK, 'utf8');
  return [...src.matchAll(/^\s*id: '([^']+)',$/gm)].map((m) => m[1]);
}

function topicCount() {
  const src = fs.readFileSync(CONTENT, 'utf8');
  return (src.match(/^\s{2}\{\s*$/gm) || []).length || (src.match(/\bday:\s*\d+/g) || []).length;
}

function assign(ids, topics) {
  const use = new Map(ids.map((id) => [id, { count: 0, last: -99 }]));
  const out = {};
  for (let t = 1; t <= topics; t += 1) {
    const taken = [];
    const prev = new Set(out[t - 1] || []);
    // Two passes: first only clips that were NOT in the previous topic, then —
    // if the deck is too small to fill six — whatever is left.
    for (const allowPrev of [false, true]) {
      const pool = ids
        .filter((id) => !taken.includes(id))
        .filter((id) => allowPrev || !prev.has(id))
        .sort((a, b) => {
          const A = use.get(a); const B = use.get(b);
          return A.count - B.count || A.last - B.last || (a < b ? -1 : 1);
        });
      for (const id of pool) {
        if (taken.length >= PER_TOPIC) break;
        taken.push(id);
      }
      if (taken.length >= PER_TOPIC) break;
    }
    taken.forEach((id) => { const u = use.get(id); u.count += 1; u.last = t; });
    out[t] = taken;
  }
  return { out, use };
}

const ids = readIds();
const topics = topicCount();
if (!ids.length) { console.error('deka boşdur — describeVideos.js oxuna bilmədi'); process.exit(1); }
const { out, use } = assign(ids, topics);

// ── statistika ────────────────────────────────────────────────────────────
const counts = [...use.values()].map((u) => u.count);
let sharedWithPrev = 0;
let dupInsideTopic = 0;
for (let t = 2; t <= topics; t += 1) {
  const prev = new Set(out[t - 1]);
  sharedWithPrev += out[t].filter((id) => prev.has(id)).length;
}
for (let t = 1; t <= topics; t += 1) {
  if (new Set(out[t]).size !== out[t].length) dupInsideTopic += 1;
}
console.log(`kliplər: ${ids.length}, mövzular: ${topics}, hərəsinə ${PER_TOPIC}`);
console.log(`hər klip işlənir: ${Math.min(...counts)}–${Math.max(...counts)} dəfə`);
console.log(`mövzu içində təkrar: ${dupInsideTopic} (0 olmalıdır)`);
let sharedWithPrev2 = 0;
for (let t = 3; t <= topics; t += 1) {
  const prev2 = new Set(out[t - 2]);
  sharedWithPrev2 += out[t].filter((id) => prev2.has(id)).length;
}
console.log(`iki əvvəlki mövzu ilə ortaq klip: ${sharedWithPrev2} ədəd`
  + (ids.length >= PER_TOPIC * 3 ? '' : ` (3 mövzu ayrı olsun deyə ${PER_TOPIC * 3} klip lazımdır)`));
console.log(`qonşu mövzu ilə ortaq klip: ${sharedWithPrev} ədəd`
  + (ids.length >= PER_TOPIC * 2 ? ' (0 olmalıdır)' : ` (deka ${PER_TOPIC * 2}-dən kiçik olduğu üçün qaçılmazdır)`));
const unique = Math.floor(ids.length / PER_TOPIC);
console.log(`tam UNİKAL dəst çıxan mövzu sayı: ${unique}/${topics}`
  + ` — hamısı unikal olsun deyə ${topics * PER_TOPIC} klip lazımdır (${topics * PER_TOPIC - ids.length} əskik)`);

if (process.argv.includes('--dry')) process.exit(0);

const body = Object.keys(out)
  .map((t) => `  ${t}: [${out[t].map((id) => `'${id}'`).join(', ')}],`)
  .join('\n');

fs.writeFileSync(OUT, `// Mövzu → klip id-ləri. QURULUR: node scripts/assign_topic_videos.js
//
// Əl ilə də düzəldilə bilər: id-lər describeVideos.js-dəki id sahələridir və
// SAXLAMA AÇARIDIR (aiSessions itemId) — əlavə et, adını dəyişmə. Bir mövzuya
// ${PER_TOPIC} klip düşür; sırası ekranda göründüyü sıradır.
//
// Klip mövzunun illüstrasiyası DEYİL — paylanma mövzu mətninə baxmır, yeganə
// məqsəd eyni klipin qonşu mövzularda təkrarlanmamasıdır. Deka böyüdükcə
// skripti yenidən işlət: ${ids.length} klipdə hər klip ${Math.min(...counts)}–${Math.max(...counts)} mövzuda görünür,
// ${topics * PER_TOPIC} klip olanda hər mövzu tamamilə özünəməxsus olacaq.
export const topicVideos = {
${body}
};

export default topicVideos;
`);
console.log(`yazıldı → ${OUT}`);
