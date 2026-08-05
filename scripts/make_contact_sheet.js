// Bir mövzunun 12 şəklini TƏK kontakt-vərəqinə (4×3 grid) yığır ki, şəkillərə
// gözlə baxmaq mümkün olsun.
//
// NİYƏ LAZIMDIR: topicImages.js-i quran generate_topic_images.js şəklin ÖZÜNƏ
// heç vaxt baxmır — yalnız Openverse başlıq/teqlərinə baxır. Ona görə "kadrda
// nə var" sualına cavab verə bilmir və altındakı sözlər axtarış sorğusundan
// götürülür (eyni sorğudan gələn 8 şəkil → eyni 3 söz). Şəkli görmədən nə pis
// kadrı atmaq, nə də şəklə özəl lüğət yazmaq olur. Bu vərəq həmin boşluğu
// bağlayır: 360 ayrı şəkil əvəzinə 30 vərəqə baxılır.
//
// İSTİFADƏ:
//   node scripts/make_contact_sheet.js --days 1,2,3 --out <qovluq>
//   node scripts/make_contact_sheet.js --all --out <qovluq>
//   node scripts/make_contact_sheet.js --unreviewed --out <qovluq>
// `--unreviewed` yalnız `reviewed` damğası OLMAYAN kadrları bütün mövzulardan
// yığıb ardıcıl vərəqlərə düzür (backfill-dən sonrakı ikinci baxış üçün). Etiket
// mövzu və indeksi göstərir — məs. `d13#10` = mövzu 13, indeks 10.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '../src/data/topicImages.js');
const UA = 'SpeakLab/1.0 (english practice app; contact poladagayev90@gmail.com)';

const COLS = 4;
const CELL_W = 320;
const CELL_H = 240;
const LABEL_H = 22;
const GAP = 6;

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { days: null, all: a.includes('--all'), out: null };
  const di = a.indexOf('--days');
  if (di >= 0 && a[di + 1]) out.days = a[di + 1].split(',').map(Number);
  const oi = a.indexOf('--out');
  if (oi >= 0 && a[oi + 1]) out.out = a[oi + 1];
  return out;
}

// topicImages.js ESM-dir, bu skript CJS — mətn kimi oxuyub require-a çeviririk.
function loadTopics() {
  let src = fs.readFileSync(SRC, 'utf8')
    .replace(/export const topicImages =/, 'module.exports =')
    .replace(/export default topicImages;?/, '');
  const tmp = path.join(require('os').tmpdir(), `ti-${Date.now()}.js`);
  fs.writeFileSync(tmp, src, 'utf8');
  const t = require(tmp);
  fs.unlinkSync(tmp);
  return t;
}

// Şəkil yüklənməsə fallbackUrl-ə keçir; ikisi də olmasa boz xana qaytarır ki,
// grid sürüşməsin və indekslər şəkillərlə uyğun qalsın.
async function fetchImage(img) {
  for (const url of [img.url, img.fallbackUrl].filter(Boolean)) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) continue; // boş/xəta cavabı
      return buf;
    } catch { /* növbəti URL */ }
  }
  return null;
}

async function cell(img, index, labelOverride) {
  const buf = await fetchImage(img);
  const base = sharp({
    create: { width: CELL_W, height: CELL_H, channels: 3, background: { r: 235, g: 235, b: 238 } },
  });
  const layers = [];
  if (buf) {
    try {
      const fitted = await sharp(buf)
        .resize(CELL_W, CELL_H, { fit: 'contain', background: { r: 235, g: 235, b: 238 } })
        .toBuffer();
      layers.push({ input: fitted, top: 0, left: 0 });
    } catch { /* dekod olunmadı → boz xana */ }
  }
  // İndeks etiketi: vərəqdə hansı şəklin hansı sıra nömrəsi olduğunu bilmək üçün.
  const label = `${labelOverride != null ? labelOverride : index}${buf ? '' : '  (YÜKLƏNMƏDİ)'}`;
  const svg = Buffer.from(
    `<svg width="${CELL_W}" height="${LABEL_H}">
       <rect width="100%" height="100%" fill="#0D1B3E"/>
       <text x="6" y="16" font-family="Arial" font-size="14" font-weight="bold" fill="#ffffff">${label}</text>
     </svg>`
  );
  const withImg = await base.composite(layers).png().toBuffer();
  return sharp({
    create: { width: CELL_W, height: CELL_H + LABEL_H, channels: 3, background: { r: 13, g: 27, b: 62 } },
  })
    .composite([{ input: svg, top: 0, left: 0 }, { input: withImg, top: LABEL_H, left: 0 }])
    .png()
    .toBuffer();
}

// `entries` = [{img, label}] — etiket ya sadə indeks, ya da `d13#10` formasıdır.
async function buildSheetFromEntries(name, entries, outDir) {
  const rows = Math.ceil(entries.length / COLS);
  const W = COLS * CELL_W + (COLS + 1) * GAP;
  const H = rows * (CELL_H + LABEL_H) + (rows + 1) * GAP;
  const cells = [];
  for (let i = 0; i < entries.length; i++) {
    cells.push({
      input: await cell(entries[i].img, i, entries[i].label),
      left: GAP + (i % COLS) * (CELL_W + GAP),
      top: GAP + Math.floor(i / COLS) * (CELL_H + LABEL_H + GAP),
    });
  }
  const outPath = path.join(outDir, `${name}.png`);
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite(cells).png({ compressionLevel: 9 }).toFile(outPath);
  return outPath;
}

async function buildSheet(day, imgs, outDir) {
  const rows = Math.ceil(imgs.length / COLS);
  const W = COLS * CELL_W + (COLS + 1) * GAP;
  const H = rows * (CELL_H + LABEL_H) + (rows + 1) * GAP;

  const cells = [];
  for (let i = 0; i < imgs.length; i++) {
    cells.push({
      input: await cell(imgs[i], i),
      left: GAP + (i % COLS) * (CELL_W + GAP),
      top: GAP + Math.floor(i / COLS) * (CELL_H + LABEL_H + GAP),
    });
  }

  const outPath = path.join(outDir, `topic-${String(day).padStart(2, '0')}.png`);
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite(cells)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

(async () => {
  const { days, all, out } = parseArgs();
  if (!out) { console.error('--out <qovluq> lazımdır'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });

  const topics = loadTopics();

  if (process.argv.includes('--unreviewed')) {
    const entries = [];
    for (const day of Object.keys(topics).map(Number).sort((a, b) => a - b)) {
      topics[day].forEach((img, i) => {
        if (!img.reviewed) entries.push({ img, label: `d${day}#${i}` });
      });
    }
    console.log(`Baxılmamış kadr: ${entries.length}`);
    for (let s = 0; s * 12 < entries.length; s++) {
      process.stdout.write(`  vərəq ${s + 1}… `);
      const p = await buildSheetFromEntries(`new-${s + 1}`, entries.slice(s * 12, s * 12 + 12), out);
      console.log(path.basename(p));
    }
    return;
  }

  let list = Object.keys(topics).map(Number).sort((a, b) => a - b);
  if (!all && days) list = list.filter((d) => days.includes(d));

  for (const day of list) {
    process.stdout.write(`  day ${day}… `);
    try {
      const p = await buildSheet(day, topics[day], out);
      console.log(path.basename(p));
    } catch (e) {
      console.log('FAILED:', e.message);
    }
  }
})();
