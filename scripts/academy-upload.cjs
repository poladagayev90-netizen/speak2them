// Publishes SpeakLab Academy (the video guides to the app) and writes the
// catalogue the speaklab.me Academy page reads.
//   node scripts/academy-upload.cjs            upload + write the site's catalogue.json
//   node scripts/academy-upload.cjs --local    NO upload: copy the files next to the
//                                              catalogue (academy/local/) for a local
//                                              check — never commit those
//
// The Academy lives on speaklab.me (repo poladagayev90-netizen.github.io,
// folder academy/), NOT in the app — Polad 2026-11-22. Commit + push that repo
// after running this.
//
// Input: the transcoded files from scripts/academy-transcode.ps1 (D:\academy_out)
// and the manifest Antigravity wrote (titles, subtitles, durations).
// Storage: `academy/v1/<series>/<lang>/<ch>_<916|169>.<mp4|jpg>` with download-token
// URLs, cached a year — the upload-materials.cjs pattern, so storage.rules stay
// closed. An object is only re-uploaded when its bytes changed (md5), so
// published URLs stay stable.
// Auth: the logged-in firebase-tools user.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUCKET = 'speak2them-64f2b.firebasestorage.app';
const ROOT = path.join(__dirname, '..');
const MANIFEST = 'C:\\Users\\p\\Desktop\\Claude_Videos\\SpeakLab\\_work\\SPEAKLAB_ACADEMY_MANIFEST.json';
const IN = process.env.ACADEMY_OUT || 'D:\\academy_out';
const OUT = process.env.ACADEMY_CATALOGUE || 'D:\\repos\\speaklab-site\\academy\\catalogue.json';
const PREFIX = 'academy/v1';
const LOCAL = process.argv.includes('--local');
const TYPES = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg' };

async function accessToken() {
  const cliRoot = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib');
  const auth = require(path.join(cliRoot, 'auth.js'));
  const config = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json'), 'utf8'));
  const t = await auth.getAccessToken(config.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  return t.access_token;
}

const publicUrl = (object, dl) =>
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(object)}?alt=media&token=${dl}`;

async function existing(token, object) {
  const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(object)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`stat ${object}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function upload(token, object, buf, contentType) {
  const dl = crypto.randomUUID();
  const meta = { name: object, contentType, cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: dl } };
  const boundary = 'b' + crypto.randomBytes(8).toString('hex');
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buf,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error(`upload ${object}: ${r.status} ${await r.text()}`);
  return publicUrl(object, dl);
}

async function publish(token, rel) {
  const file = path.join(IN, rel);
  const buf = fs.readFileSync(file);
  if (LOCAL) {
    const dest = path.join(path.dirname(OUT), 'local', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
    return `local/${rel.split(path.sep).join('/')}`;
  }
  const object = `${PREFIX}/${rel.split(path.sep).join('/')}`;
  const md5 = crypto.createHash('md5').update(buf).digest('base64');
  const prev = await existing(token, object);
  const dl = prev?.metadata?.firebaseStorageDownloadTokens?.split(',')[0];
  if (prev && prev.md5Hash === md5 && dl) return publicUrl(object, dl);
  const url = await upload(token, object, buf, TYPES[path.extname(file)]);
  console.log(`  up ${object} ${(buf.length / 1048576).toFixed(2)} MB`);
  return url;
}

// "SpeakLab — Tələbə Bələdçisi" → "Tələbə Bələdçisi": the app already says SpeakLab.
const shortTitle = (t) => t.replace(/^SpeakLab\s*[—–-]\s*/, '');

(async () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const token = LOCAL ? null : await accessToken();
  const series = [];
  for (const c of manifest.courses) {
    let s = series.find((x) => x.id === c.series);
    if (!s) series.push((s = { id: c.series, langs: {} }));
    const chapters = [];
    for (const ch of [...c.chapters].sort((a, b) => a.order - b.order)) {
      const base = path.join(c.series, c.language, ch.id);
      chapters.push({
        id: ch.id,
        title: ch.title,
        subtitle: ch.subtitle,
        dur: Math.round(ch.video9x16.durationSec * 10) / 10,
        portrait: { src: await publish(token, `${base}_916.mp4`), poster: await publish(token, `${base}_916.jpg`) },
        landscape: { src: await publish(token, `${base}_169.mp4`), poster: await publish(token, `${base}_169.jpg`) },
      });
    }
    s.langs[c.language] = { title: shortTitle(c.title), description: c.description, chapters };
    console.log(`${c.id}: ${chapters.length} chapters`);
  }
  // Every series must carry the same chapter ids in every language: progress is
  // stored per series + chapter id, so AZ ↔ TR keeps it.
  for (const s of series) {
    const ids = Object.values(s.langs).map((l) => l.chapters.map((ch) => ch.id).join());
    if (new Set(ids).size !== 1) throw new Error(`${s.id}: chapter ids differ between languages`);
  }
  fs.writeFileSync(OUT, JSON.stringify({ version: 1, series }));
  console.log(`wrote ${OUT}${LOCAL ? ' (LOCAL — do not commit)' : ''}`);
})().catch((e) => { console.error(e); process.exit(1); });
