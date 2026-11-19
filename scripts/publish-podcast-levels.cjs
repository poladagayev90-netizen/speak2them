// Publishes the levelled podcast episodes (A1/A2/B1/B2 per topic) for the
// level switch in the Listen tab.
//
//   node scripts/publish-podcast-levels.cjs [NN ...] [--src <dir>]           DRY RUN (default)
//   node scripts/publish-podcast-levels.cjs [NN ...] [--src <dir>] --upload  uploads + writes data
//   node scripts/publish-podcast-levels.cjs [NN ...] [--src <dir>] --local-audio
//
// Reads, under --src (default: this repo):
//   content/materials/NN/levels/<L>/script.json   lines [{s, t}]
//   content/materials/NN/levels/<L>/qa.json       `at` = start second of each line, `duration`
//   content/materials/NN/levels/<L>/podcast.mp3   the voiced episode (gitignored)
//   docs/reviews/*vocab*.csv                      the level's word lists (core / phrasal verb /
//                                                 idiom / chunk; the «extended» layer is for teachers)
//
// DRY RUN prints what would go to Storage and writes nothing.
// --upload puts each mp3 into Storage at `materials/NN/levels/<L>/podcast.mp3` — a NEW
//   path; the live B1 podcast (`materials/NN/podcast.mp3`) is never touched — with a
//   download-token URL (the upload-materials.cjs pattern: firebase-tools refresh token +
//   GCS JSON API, `firebaseStorageDownloadTokens`), records it in
//   content/materials/NN/levels/published.json and writes src/data/topicMaterials/levels/NN.json.
//   An unchanged mp3 (same sha256) is not uploaded again, so URLs stay stable.
// --local-audio writes the data with `/staged-levels/NN/<L>.mp3` URLs and copies the mp3s
//   to public/staged-levels/ — only to try the switch on a local build. Never commit that output.
//
// A level is shipped only when its script, its timings (one `at` per line, rising) and its
// audio are all there; any other level falls back to the topic's live B1 episode in the app.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUCKET = 'speak2them-64f2b.firebasestorage.app';
const ROOT = path.join(__dirname, '..');
const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const OUT = path.join(ROOT, 'src/data/topicMaterials/levels');

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const srcIdx = argv.indexOf('--src');
const SRC_ROOT = srcIdx >= 0 ? path.resolve(argv[srcIdx + 1]) : ROOT;
const MODE = flag('--upload') ? 'upload' : flag('--local-audio') ? 'local' : 'dry';
const MATERIALS = path.join(SRC_ROOT, 'content/materials');
const REVIEWS = path.join(SRC_ROOT, 'docs/reviews');

// ── word lists ──────────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// One sheet (2026-11-19_vocab_batch_26-30.csv) was written with every data
// line missing its first and last quote (`26 Dreams…","A1",…,"`). Such a file
// is mended line by line; well-formed sheets pass through unchanged.
const fixHeader = (text) => {
  const lines = text.split(/\r?\n/);
  if (!lines[1] || lines[1].startsWith('"')) return text;
  return lines.map((l, i) => {
    if (i === 0) return l.endsWith('"') ? l : `${l}"`;
    return /^\d\d /.test(l) ? `"${l}"` : '';
  }).filter(Boolean).join('\n');
};

const KIND = { 'core word': 'word', 'phrasal verb': 'phrasal', 'idiom / chunk': 'idiom' };

function loadWords() {
  const byTopic = {}; // nn -> level -> [{phrase, kind, az, tr, en, example}]
  if (!fs.existsSync(REVIEWS)) return byTopic;
  for (const f of fs.readdirSync(REVIEWS).filter((x) => /vocab_batch_.*\.csv$|pilot_\d\d_.*\.csv$/.test(x))) {
    const rows = parseCsv(fixHeader(fs.readFileSync(path.join(REVIEWS, f), 'utf8').replace(/^﻿/, '')));
    const head = rows.shift().map((h) => h.trim());
    const fileTopic = (f.match(/pilot_(\d\d)_/) || [])[1];
    for (const r of rows) {
      if (r.length < head.length - 1) continue;
      const o = Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()]));
      const nn = fileTopic || (o.topic.match(/^(\d\d)\b/) || [])[1];
      const kind = KIND[o.layer];
      if (!nn || !kind || !LEVELS.includes(o.level) || !o.item) continue;
      const w = { phrase: o.item, kind: kind === 'idiom' && o.type === 'chunk' ? 'chunk' : kind };
      const az = o.meaning_az || o.az_gloss;
      if (az) w.az = az;
      if (o.meaning_tr) w.tr = o.meaning_tr;
      if (o.meaning_en) w.en = o.meaning_en;
      if (o.example) w.example = o.example;
      ((byTopic[nn] ||= {})[o.level] ||= []).push(w);
    }
  }
  return byTopic;
}

// ── episodes ────────────────────────────────────────────────────────────────
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);

function episodeOf(nn, level) {
  const dir = path.join(MATERIALS, nn, 'levels', level);
  const script = readJson(path.join(dir, 'script.json'));
  const qa = readJson(path.join(dir, 'qa.json'));
  const mp3 = path.join(dir, 'podcast.mp3');
  if (!script) return { skip: 'no script' };
  if (!qa?.at) return { skip: 'no timings (qa.json) yet' };
  if (qa.at.length !== script.lines.length) return { skip: `timings ${qa.at.length} ≠ lines ${script.lines.length}` };
  if (qa.at.some((a, i) => typeof a !== 'number' || (i > 0 && a < qa.at[i - 1]))) return { skip: 'timings not rising' };
  if (!fs.existsSync(mp3)) return { skip: 'no podcast.mp3 yet' };
  return {
    mp3,
    data: {
      level,
      title: script.title,
      duration: qa.duration,
      lines: script.lines.map((l, i) => ({ s: l.s, t: l.t, at: qa.at[i] })),
    },
  };
}

async function accessToken() {
  const cliRoot = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib');
  const auth = require(path.join(cliRoot, 'auth.js'));
  const config = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json'), 'utf8'));
  const t = await auth.getAccessToken(config.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  return t.access_token;
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
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(object)}?alt=media&token=${dl}`;
}

(async () => {
  const picked = argv.filter((a, i) => /^\d\d$/.test(a) && argv[i - 1] !== '--src');
  const topics = picked.length ? picked
    : fs.readdirSync(MATERIALS).filter((f) => /^\d\d$/.test(f) && fs.existsSync(path.join(MATERIALS, f, 'levels')));
  const words = loadWords();
  const token = MODE === 'upload' ? await accessToken() : null;
  let count = 0;
  let bytes = 0;
  console.log(`${MODE === 'dry' ? 'DRY RUN — nothing is uploaded or written' : MODE === 'upload' ? 'UPLOAD' : 'LOCAL AUDIO (do not commit the output)'}; source ${SRC_ROOT}`);

  for (const nn of topics) {
    const lockPath = path.join(MATERIALS, nn, 'levels', 'published.json');
    const lock = readJson(lockPath) || {};
    const out = {};
    const notes = [];
    for (const level of LEVELS) {
      const ep = episodeOf(nn, level);
      if (ep.skip) { notes.push(`${level}: skip (${ep.skip})`); continue; }
      const buf = fs.readFileSync(ep.mp3);
      const sha = crypto.createHash('sha256').update(buf).digest('hex');
      const object = `materials/${nn}/levels/${level}/podcast.mp3`;
      const fresh = lock[level]?.sha === sha;
      let audio = fresh ? lock[level].url : null;
      if (MODE === 'dry') {
        notes.push(`${level}: ${fresh ? 'already uploaded' : `would upload gs://${BUCKET}/${object} (${Math.round(buf.length / 1024)} KB)`}`);
        if (!fresh) { count += 1; bytes += buf.length; }
      } else if (MODE === 'upload') {
        if (!fresh) {
          audio = await upload(token, object, buf, 'audio/mpeg');
          lock[level] = { sha, url: audio };
          count += 1; bytes += buf.length;
          notes.push(`${level}: uploaded (${Math.round(buf.length / 1024)} KB)`);
        } else notes.push(`${level}: unchanged`);
      } else {
        const dest = path.join(ROOT, 'public/staged-levels', nn);
        fs.mkdirSync(dest, { recursive: true });
        fs.copyFileSync(ep.mp3, path.join(dest, `${level}.mp3`));
        audio = `/staged-levels/${nn}/${level}.mp3`;
        notes.push(`${level}: local audio`);
      }
      const w = words[nn]?.[level] || [];
      if (!w.length) notes.push(`${level}: no word list found`);
      if (audio) out[level] = { ...ep.data, audio, words: w };
    }
    console.log(`${nn}  ${notes.join(' · ')}`);
    if (MODE === 'dry') continue;
    if (MODE === 'upload') fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    if (Object.keys(out).length) {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${nn}.json`), JSON.stringify(out) + '\n');
    }
  }
  if (MODE !== 'local') console.log(`${MODE === 'dry' ? 'would upload' : 'uploaded'}: ${count} files, ${(bytes / 1048576).toFixed(1)} MB`);
})().catch((e) => { console.error(e.message); process.exit(1); });
