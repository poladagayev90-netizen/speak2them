// Regenerates the Android launcher icons from the web logo.
//
// The Android icons are a separate copy of the brand mark, so a logo refresh in
// public/ silently leaves the APK showing the old icon — which is exactly what
// happened (public/*.png updated 8 Jul, mipmap/* stale from 5 Jul). Run this
// whenever the logo changes:
//
//   node scripts/generate-android-icons.js
//
// Sizes follow the standard mipmap buckets. Adaptive icons (API 26+, which is
// everything above our minSdk 24 in practice) use ic_launcher_foreground on top
// of the @color/ic_launcher_background colour; the legacy square/round PNGs are
// only read by API 24-25 launchers but are kept in sync anyway.

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'logo512.png'); // transparent brand mark
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const BG = { r: 0xf6, g: 0xf6, b: 0xfb, alpha: 1 }; // matches icon-maskable-512

const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

// An adaptive foreground is scaled and mask-clipped by the launcher: only the
// centre ~66% is guaranteed visible, so the mark must stay well inside it.
const FOREGROUND_MARK_RATIO = 0.62;
const LEGACY_MARK_RATIO = 0.72;

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function markAt(size) {
  return sharp(SRC)
    .resize(size, size, { fit: 'contain', background: transparent })
    .toBuffer();
}

async function writeForegrounds() {
  for (const [density, size] of Object.entries(FOREGROUND)) {
    const mark = await markAt(Math.round(size * FOREGROUND_MARK_RATIO));
    await sharp({ create: { width: size, height: size, channels: 4, background: transparent } })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toFile(path.join(RES, `mipmap-${density}`, 'ic_launcher_foreground.png'));
  }
}

async function writeLegacy() {
  for (const [density, size] of Object.entries(LAUNCHER)) {
    const mark = await markAt(Math.round(size * LEGACY_MARK_RATIO));

    const square = await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(RES, `mipmap-${density}`, 'ic_launcher.png'), square);

    // API 24-25 round launchers draw this as-is, so it has to be a real circle.
    const circle = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );
    const round = await sharp(square)
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(RES, `mipmap-${density}`, 'ic_launcher_round.png'), round);
  }
}

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`Missing source logo: ${SRC}`);
  await writeForegrounds();
  await writeLegacy();
  console.log('Android launcher icons regenerated from public/logo512.png');
})();
