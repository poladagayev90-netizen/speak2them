// Publishes the topic listening/reading materials.
//   node scripts/upload-materials.cjs 01 [02 ...]   (no args = every folder in content/materials)
// For each topic NN it uploads content/materials/NN/{listening.mp3, scene*.webp} to
// Storage `materials/NN/...` (download-token URLs, cached a year — the saveStoryAudio
// pattern) and writes src/data/topicMaterials/NN.json = content/materials/NN.json + URLs.
// A file is only re-uploaded when its bytes changed, so published URLs stay stable.
// Auth: the logged-in firebase-tools user (same as scripts/audit-student-stats.cjs).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUCKET = 'speak2them-64f2b.firebasestorage.app';
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'content/materials');
const OUT = path.join(ROOT, 'src/data/topicMaterials');
const TYPES = { '.mp3': 'audio/mpeg', '.webp': 'image/webp' };

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

// Polad's rule (2026-10-11): every word and idiom of the topic is used at least
// once in the podcast or the readings. Same matching as utils/topicMaterials.js.
function topicOf(nn) {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/weeklyContent.js'), 'utf8')
    .replace(/^import .*$/m, '').replace('export const weeklyContent', 'globalThis.__wc').split('export function')[0];
  // eslint-disable-next-line no-eval -- our own data file, read at build time
  eval(src);
  return globalThis.__wc[Number(nn) - 1];
}
function warnUnusedVocabulary(nn, texts) {
  const topic = topicOf(nn);
  const all = texts.join(' \n ');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const phrases = [...topic.vocabulary.map((v) => v.word), ...topic.idioms.map((v) => v.phrase)];
  const unused = phrases.filter((p) => !new RegExp(`\\b${esc(p)}(?:s|es|ed|d|ing)?\\b`, 'i').test(all));
  if (unused.length) console.warn(`  ! ${nn}: not used yet — ${unused.join(', ')}`);
  else console.log(`  all ${phrases.length} topic words and idioms are used`);
}

async function publish(token, nn) {
  const dir = path.join(SRC, nn);
  // NN.json holds the reading; a topic may get its podcast first.
  const readingPath = path.join(SRC, `${nn}.json`);
  const data = fs.existsSync(readingPath) ? JSON.parse(fs.readFileSync(readingPath, 'utf8')) : { index: Number(nn) - 1 };
  const lockPath = path.join(dir, 'published.json'); // file -> {sha, url}
  const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : {};
  const urlOf = async (file) => {
    const buf = fs.readFileSync(path.join(dir, file));
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    if (lock[file]?.sha === sha) return lock[file].url;
    const url = await upload(token, `materials/${nn}/${file}`, buf, TYPES[path.extname(file)]);
    lock[file] = { sha, url };
    console.log(`  uploaded ${file} (${Math.round(buf.length / 1024)} KB)`);
    return url;
  };
  // The podcast episode (content/materials/NN.podcast.json) is the listening
  // now; the earlier Julian dialogue (`listening`) stays in content/ only.
  delete data.listening;
  const podPath = path.join(SRC, `${nn}.podcast.json`);
  if (fs.existsSync(podPath)) {
    const pod = JSON.parse(fs.readFileSync(podPath, 'utf8'));
    if (pod.lines.some((l) => typeof l.at !== 'number')) throw new Error(`${nn}: every podcast line needs its start time "at" (scripts/align-listening.py)`);
    pod.audio = await urlOf('podcast.mp3');
    if (fs.existsSync(path.join(dir, 'cover.webp'))) pod.cover = await urlOf('cover.webp');
    for (const c of pod.chapters) {
      c.src = await urlOf(`${c.image}.webp`);
      delete c.prompt; // generation prompts stay in content/, the app doesn't need them
    }
    delete pod.voiceDirection; // TTS persona notes, not for learners
    data.podcast = pod;
    warnUnusedVocabulary(nn, [...pod.lines.map((l) => l.t), ...['A2', 'B1', 'B2'].map((l) => data.reading?.[l]?.text || '')]);
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${nn}.json`), JSON.stringify(data) + '\n');
  console.log(`${nn}: wrote src/data/topicMaterials/${nn}.json`);
}

(async () => {
  const args = process.argv.slice(2);
  const topics = args.length ? args : fs.readdirSync(SRC).filter((f) => /^\d\d$/.test(f));
  const token = await accessToken();
  for (const nn of topics) await publish(token, nn);
})().catch((e) => { console.error(e.message); process.exit(1); });
