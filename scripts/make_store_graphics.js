// Play Console «feature graphic» (1024×500) qurur.
//
// SPEC (STORE_LISTING.md §3): DƏQİQ 1024×500, JPG və ya 24-bit PNG, ŞƏFFAFLIQ
// YOX. Mərkəzə çox söz yığmaq olmaz — bəzi cihazlarda Play öz düymələrini
// üstünə qoyur, ona görə mətn sola, loqo sağa yığılıb.
//
// Brend: Light Mode, Ink Navy #0D1B3E başlıq, Lab Violet #6D3BEB + Neon Cyan
// #12BBD6 işıqlanma, ağ fon.
//
// İSTİFADƏ: node scripts/make_store_graphics.js [--out <qovluq>]

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 1024, H = 500;
const INK = '#0D1B3E';
const VIOLET = '#6D3BEB';
const CYAN = '#12BBD6';
const LOGO = path.join(__dirname, '../public/logo512.png');

function outDir() {
  const i = process.argv.indexOf('--out');
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : path.join(__dirname, '../store_assets');
}

// Fon: ağ səth + iki yumşaq radial işıq (bənövşəyi sağ-yuxarı, mavi sol-aşağı).
// Şəffaflıq YOXDUR — bütün sahə doludur, Play tələbi budur.
const background = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glowV" cx="78%" cy="18%" r="58%">
      <stop offset="0%"   stop-color="${VIOLET}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowC" cx="12%" cy="92%" r="55%">
      <stop offset="0%"   stop-color="${CYAN}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${CYAN}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${VIOLET}"/>
      <stop offset="100%" stop-color="${CYAN}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  <rect width="${W}" height="${H}" fill="url(#glowV)"/>
  <rect width="${W}" height="${H}" fill="url(#glowC)"/>
  <rect x="64" y="196" width="72" height="6" rx="3" fill="url(#rule)"/>
</svg>`;

// Mətn ayrıca qatdır ki, fon işıqları onun üstünə düşməsin.
const text = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .h  { font-family: Arial, Helvetica, sans-serif; font-weight: 700; fill: ${INK}; }
    .s  { font-family: Arial, Helvetica, sans-serif; font-weight: 400; fill: #4A5578; }
    .u  { font-family: Arial, Helvetica, sans-serif; font-weight: 700; fill: ${VIOLET}; }
  </style>
  <text class="h" x="64" y="152" font-size="66">Danışaraq öyrən</text>
  <text class="s" x="64" y="250" font-size="26">Real partnyorlarla canlı İngilis praktikası.</text>
  <text class="s" x="64" y="288" font-size="26">Bir toxunuşla partnyor tapılır, zəng başlayır.</text>
  <text class="u" x="64" y="428" font-size="22" letter-spacing="1">speaklab.az</text>
</svg>`;

// ── Play screenshot-ları ────────────────────────────────────────────────────
// Xam ekran şəkli 1080×1920-dir (9:16). Onu olduğu kimi yükləmək olar, amma
// listinqdə başlıqlı variant daha aydın oxunur. Nisbət pozulmasın deyə eyni
// 1080×1920 kətan saxlanılır: yuxarıda başlıq zolağı, altında ekran şəkli.
const SHOT_W = 1080, SHOT_H = 1920;

async function framedShot(srcPath, caption, outPath) {
  const capH = 300;
  const inner = await sharp(srcPath)
    .resize(SHOT_W - 96, SHOT_H - capH - 48, { fit: 'contain', background: '#0B0A1C' })
    .toBuffer();
  const im = await sharp(inner).metadata();

  const bg = `
  <svg width="${SHOT_W}" height="${SHOT_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#141235"/>
        <stop offset="100%" stop-color="#0B0A1C"/>
      </linearGradient>
      <radialGradient id="v" cx="80%" cy="4%" r="60%">
        <stop offset="0%"   stop-color="${VIOLET}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${SHOT_W}" height="${SHOT_H}" fill="url(#g)"/>
    <rect width="${SHOT_W}" height="${SHOT_H}" fill="url(#v)"/>
    <rect x="72" y="196" width="64" height="6" rx="3" fill="${CYAN}"/>
  </svg>`;

  // Başlıq uzundursa iki sətrə bölünür — SVG-də avtomatik sətir keçidi yoxdur.
  const words = caption.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 24) { lines.push(cur.trim()); cur = w; }
    else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());

  const capSvg = `
  <svg width="${SHOT_W}" height="${SHOT_H}" xmlns="http://www.w3.org/2000/svg">
    <style>.c { font-family: Arial, Helvetica, sans-serif; font-weight: 700; fill: #FFFFFF; }</style>
    ${lines.map((l, i) => `<text class="c" x="72" y="${112 + i * 62}" font-size="50">${l}</text>`).join('')}
  </svg>`;

  await sharp(Buffer.from(bg))
    .composite([
      { input: Buffer.from(capSvg), left: 0, top: 0 },
      { input: inner, left: Math.round((SHOT_W - im.width) / 2), top: capH },
    ])
    .flatten({ background: '#0B0A1C' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

(async () => {
  const dir = outDir();
  fs.mkdirSync(dir, { recursive: true });

  // Loqo sağda, yumşaq bənövşəyi halqa içində.
  const logoSize = 268;
  const halo = Buffer.from(`
    <svg width="${logoSize + 96}" height="${logoSize + 96}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="h" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stop-color="${VIOLET}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="${(logoSize + 96) / 2}" cy="${(logoSize + 96) / 2}" r="${(logoSize + 96) / 2}" fill="url(#h)"/>
    </svg>`);

  const logo = await sharp(LOGO).resize(logoSize, logoSize, { fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  const logoX = 690, logoY = (H - logoSize) / 2;

  const out = path.join(dir, 'feature-graphic-1024x500.png');
  await sharp(Buffer.from(background))
    .composite([
      { input: halo, left: logoX - 48, top: logoY - 48 },
      { input: logo, left: logoX, top: logoY },
      { input: Buffer.from(text), left: 0, top: 0 },
    ])
    // flatten şəffaf pikselləri ağ edir, removeAlpha isə alfa KANALINI atır.
    // İkisi ayrı şeydir: yalnız flatten qoysaq fayl yenə 4 kanallı RGBA qalır və
    // Play onu 24-bit PNG saymır.
    .flatten({ background: '#FFFFFF' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);

  const meta = await sharp(out).metadata();
  console.log(`${out}`);
  console.log(`  ${meta.width}×${meta.height}, ${meta.channels} kanal, alpha: ${meta.hasAlpha}`);
  if (meta.width !== W || meta.height !== H) console.log('  XƏBƏRDARLIQ: ölçü səhvdir');
  if (meta.hasAlpha) console.log('  XƏBƏRDARLIQ: alfa kanalı var, Play şəffaflığı qəbul etmir');

  // Screenshot-lar: xam fayllar --shots <qovluq> ilə verilir (Playwright çıxışı).
  const si = process.argv.indexOf('--shots');
  if (si < 0) { console.log('\n(--shots verilmədi, screenshot çərçivəsi atlandı)'); return; }
  const shotsDir = process.argv[si + 1];

  const PLAN = [
    ['01-home.png',           'Bir toxunuşla canlı partnyor'],
    ['10-call.png',           'Real insanlarla canlı zəng'],
    ['12-question-card.png',  'Hər zəngə hazır sual kartları'],
    ['14-picture-frames.png', 'Şəkli təsvir et — söz və qəliblərlə'],
    ['03-questions.png',      'Gündəlik mövzu: söz, idiom, sual'],
  ];

  console.log('');
  let n = 0;
  for (const [file, caption] of PLAN) {
    const src = path.join(shotsDir, file);
    if (!fs.existsSync(src)) { console.log(`  atlandı (yoxdur): ${file}`); continue; }
    n++;
    const out2 = path.join(dir, `screenshot-${String(n).padStart(2, '0')}.png`);
    await framedShot(src, caption, out2);
    const m2 = await sharp(out2).metadata();
    console.log(`  ${path.basename(out2)}  ${m2.width}×${m2.height}  alpha:${m2.hasAlpha}  ← ${caption}`);
  }
  console.log(`\n${n} screenshot hazırdır (Play minimum 2 tələb edir).`);
})();
