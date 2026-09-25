// Yeni klipləri tətbiqə salmaq üçün boru xətti (describeVideos.js + public/videos).
//
// NİYƏ İKİ ADDIM: klipə BAXMADAN nə pis kadrı atmaq, nə də şəklə özəl lüğət
// yazmaq mümkün deyil (şəkil dəstində eyni dərs alınmışdı — bax
// scripts/make_contact_sheet.js). Ona görə:
//
//   1) node scripts/ingest_videos.js --scan --from "<qovluq>"
//      Hər video üçün 8 kadrlıq KONTAKT VƏRƏQİ çəkir (video_review/sheets/)
//      və video_review/inbox.json yazır — hər girişdə boş `id`, `keywords`,
//      `prompts`. Heç nəyi tətbiqə salmır.
//
//   2) (insan və ya agent) vərəqlərə baxır, inbox.json-u doldurur:
//      - `id`: qısa, mənalı, kiçik hərflə ("pier-fish"). SAXLAMA AÇARIDIR,
//        sonra ADI DƏYİŞMƏ. Boş qoyulan giriş ATLANIR — pis klipi belə at.
//      - `keywords`: ekranda GÖRÜNƏN 5 söz (mövzu lüğətindən yox).
//      - `prompts`: 2 sual.
//      - `start`/`seconds`: klipin hansı hissəsi (default 0, ≤26 san).
//      - `blur`: [{x,y,w,h,until?}] — yandırılmış altyazını örtmək üçün.
//        Koordinatlar ÇIXIŞ ölçüsündədir (480 en), `until` saniyədir.
//
//   3) node scripts/ingest_videos.js --apply
//      Kodlayır (səssiz, ~480px, faststart), poster çıxarır, describeVideos.js
//      sonuna əlavə edir. Sonra:
//        node scripts/build_keyword_glossary.js   # yeni sözlərin az/tr-i
//        node scripts/assign_topic_videos.js      # mövzulara paylanma
//
// SƏS QƏSDƏN SİLİNİR: orijinal səs sosial media musiqisi/başqa dildə voice-over
// olur və təsviri şagirdin əvəzinə edir. Səsli klip lazım olsa, bu qərar bir
// yerdə dəyişir: aşağıdakı `-an`.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VIDEO_DIR = path.join(ROOT, 'public/videos');
const DECK = path.join(ROOT, 'src/data/describeVideos.js');
const argOf = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const OUT_DIR = path.resolve(argOf('--out', path.join(ROOT, 'video_review')));
const INBOX = path.join(OUT_DIR, 'inbox.json');
const MAX_SECONDS = Number(argOf('--max-seconds', 26));
const WIDTH = 480;          // portrait clips; landscape gets 640 (see scaleExpr)
const scaleExpr = `scale='if(gt(iw,ih),640,${WIDTH})':-2:flags=lanczos`;

const ff = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const duration = (file) => Number(ff('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
]).trim());

function scan(from) {
  fs.mkdirSync(path.join(OUT_DIR, 'sheets'), { recursive: true });
  const known = new Set(fs.existsSync(DECK)
    ? [...fs.readFileSync(DECK, 'utf8').matchAll(/\/\/ source: (.+)$/gm)].map((m) => m[1].trim())
    : []);
  const files = fs.readdirSync(from).filter((f) => /\.(mp4|mov|webm|m4v)$/i.test(f));
  const rows = [];
  files.forEach((f, i) => {
    if (known.has(f)) { console.log(`atlandı (artıq dekada): ${f}`); return; }
    const full = path.join(from, f);
    let dur;
    try { dur = duration(full); } catch { console.log(`oxuna bilmədi: ${f}`); return; }
    const n = String(i + 1).padStart(3, '0');
    const sheet = path.join(OUT_DIR, 'sheets', `${n}.jpg`);
    // 8 kadr bir sətirdə — 8 ayrı Read əvəzinə bir şəkil.
    ff('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', full,
      '-vf', `fps=${(8 / dur).toFixed(4)},scale=200:266:force_original_aspect_ratio=decrease,pad=200:266:-1:-1:color=black,tile=8x1`,
      '-frames:v', '1', '-q:v', '4', sheet]);
    rows.push({
      sheet: path.relative(OUT_DIR, sheet).replace(/\\/g, '/'),
      source: f,
      sourceSeconds: Number(dur.toFixed(1)),
      id: '',
      start: 0,
      seconds: Math.min(MAX_SECONDS, Math.round(dur)),
      posterAt: Math.min(3, Math.round(dur / 3)),
      alt: '',
      keywords: [],
      prompts: [],
      blur: [],
    });
    console.log(`vərəq: ${path.basename(sheet)}  ←  ${f} (${dur.toFixed(1)} san)`);
  });
  fs.writeFileSync(INBOX, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`\n${rows.length} yeni video → ${INBOX}`);
  console.log('Vərəqlərə bax, id/keywords/prompts doldur, sonra: node scripts/ingest_videos.js --apply');
}

function encode(row, from) {
  const src = path.join(from, row.source);
  const out = path.join(VIDEO_DIR, `${row.id}.mp4`);
  const poster = path.join(VIDEO_DIR, `${row.id}.jpg`);
  const boxes = Array.isArray(row.blur) ? row.blur : [];
  const args = ['-nostdin', '-v', 'error', '-y', '-ss', String(row.start || 0), '-i', src,
    '-t', String(Math.min(row.seconds || MAX_SECONDS, MAX_SECONDS)), '-an', '-map_metadata', '-1'];
  if (boxes.length) {
    // Hər qutu: kəs → blurla → üstünə qoy. `until` verilibsə yalnız o vaxta qədər.
    const chain = [`[0:v]${scaleExpr}[v0]`];
    boxes.forEach((b, i) => {
      const en = b.until ? `:enable='lte(t,${b.until})'` : '';
      chain.push(`[v${i}]split[b${i}][c${i}]`);
      chain.push(`[c${i}]crop=${b.w}:${b.h}:${b.x}:${b.y},avgblur=30[bl${i}]`);
      chain.push(`[b${i}][bl${i}]overlay=${b.x}:${b.y}${en}[v${i + 1}]`);
    });
    args.push('-filter_complex', chain.join(';'), '-map', `[v${boxes.length}]`);
  } else {
    args.push('-vf', scaleExpr);
  }
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '32', '-maxrate', '750k', '-bufsize', '1400k',
    '-profile:v', 'main', '-level', '3.1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '24', out);
  ff('ffmpeg', args);
  ff('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-ss', String(row.posterAt || 1), '-i', out,
    '-frames:v', '1', '-q:v', '6', poster]);
  return { out, bytes: fs.statSync(out).size };
}

function apply(from) {
  if (!fs.existsSync(INBOX)) { console.error(`${INBOX} yoxdur — əvvəlcə --scan`); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(INBOX, 'utf8'));
  const ready = rows.filter((r) => r.id && r.keywords?.length && r.prompts?.length);
  const skipped = rows.length - ready.length;
  if (!ready.length) { console.error('doldurulmuş giriş yoxdur (id + keywords + prompts lazımdır)'); process.exit(1); }

  const deckSrc = fs.readFileSync(DECK, 'utf8');
  const existing = new Set([...deckSrc.matchAll(/^\s*id: '([^']+)',$/gm)].map((m) => m[1]));
  const entries = [];
  for (const row of ready) {
    if (existing.has(row.id)) { console.log(`atlandı (id artıq var): ${row.id}`); continue; }
    if (row.keywords.length > 5) { console.log(`XƏBƏRDARLIQ ${row.id}: 5-dən çox söz, ilk 5 götürülür`); }
    const { bytes } = encode(row, from);
    const kw = row.keywords.slice(0, 5).map((w) => `'${w.replace(/'/g, "\\'")}'`).join(', ');
    const pr = row.prompts.slice(0, 2).map((p) => `      '${p.replace(/'/g, "\\'")}',`).join('\n');
    entries.push(`  {
    // source: ${row.source}
    id: '${row.id}',
    src: '/videos/${row.id}.mp4',
    poster: '/videos/${row.id}.jpg',
    seconds: ${Math.min(row.seconds || MAX_SECONDS, MAX_SECONDS)},
    alt: '${(row.alt || '').replace(/'/g, "\\'")}',
    keywords: [${kw}],
    prompts: [
${pr}
    ],
  },`);
    console.log(`əlavə edildi: ${row.id} (${(bytes / 1024).toFixed(0)} KB)`);
  }
  if (!entries.length) { console.log('yeni giriş yoxdur'); return; }

  // The closing "];" of the deck array. CRLF-tolerant: a Windows checkout
  // (core.autocrlf) turns the file into CRLF and a plain '\n];\n' never matches.
  const ends = [...deckSrc.matchAll(/\n\];\r?\n/g)];
  const at = ends.length ? ends[ends.length - 1].index : -1;
  if (at < 0) { console.error('describeVideos.js-in sonu tapılmadı'); process.exit(1); }
  fs.writeFileSync(DECK, deckSrc.slice(0, at + 1) + entries.join('\n') + deckSrc.slice(at + 1));
  console.log(`\n${entries.length} klip → describeVideos.js  (${skipped} doldurulmamış giriş atlandı)`);
  console.log('İndi: node scripts/build_keyword_glossary.js && node scripts/assign_topic_videos.js');
}

const from = path.resolve(argOf('--from', 'C:/Users/p/Downloads/Telegram Desktop'));
if (process.argv.includes('--apply')) apply(from);
else if (process.argv.includes('--scan')) scan(from);
else {
  console.log('istifadə: node scripts/ingest_videos.js --scan --from "<qovluq>"');
  console.log('          node scripts/ingest_videos.js --apply --from "<qovluq>"');
}
