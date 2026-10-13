// Records the pronunciation of every topic word and idiom (and the readings' extra
// words) with the Gemini API and publishes them to Storage `pronounce/<slug>.mp3`:
//   node scripts/pronounce-tts.cjs            (only what is missing, changed or from another model)
//   ONLY="jet lag,layover" node scripts/pronounce-tts.cjs   (re-record these)
// The TTS models allow only ~100 requests a DAY, so one request reads a list of
// BATCH (12) words with long pauses and the audio is cut at the pauses; a batch
// whose pauses do not give exactly one clip per word is asked again, and after
// three tries its words are left for the next run. ~55 requests for everything.
// Every file carries the SAME download token (PRONOUNCE_TOKEN in src/utils/pronounce.js),
// so the app builds a URL from the word alone and src/data/pronunciations.json is
// just the list of slugs that exist. Words without a file fall back to the
// browser's voice. Auth for Storage: the logged-in firebase-tools user
// (same as scripts/upload-materials.cjs).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUCKET = 'speak2them-64f2b.firebasestorage.app';
const TOKEN = '772f89e8-ff7a-44f4-bebf-dddc519e6808'; // = PRONOUNCE_TOKEN in src/utils/pronounce.js
const MODEL = process.env.TTS_MODEL || 'gemini-2.5-pro-preview-tts';
const VOICE = process.env.TTS_VOICE || 'Kore';
const BATCH = Number(process.env.BATCH || 12);
const DIR = path.join(ROOT, 'content/pronounce');
const LOCK = path.join(DIR, 'published.json'); // slug -> {text, sha, sec, model}
const OUT = path.join(ROOT, 'src/data/pronunciations.json');
const KEY = (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m) || [])[1]?.replace(/["\r\s]/g, '');
if (!KEY) throw new Error('GEMINI_API_KEY missing in .env');

// Must stay identical to pronounceSlug in src/utils/pronounce.js.
const slugOf = (t) => String(t).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function terms() {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/weeklyContent.js'), 'utf8')
    .replace(/^import .*$/mg, '').replace('export const weeklyContent', 'globalThis.__wc').split('export function')[0];
  // eslint-disable-next-line no-eval -- our own data file, read at build time
  eval(src);
  const out = new Map();
  const add = (t) => { const s = slugOf(t); if (s && !out.has(s)) out.set(s, String(t).trim()); };
  for (const topic of globalThis.__wc) {
    (topic.vocabulary || []).forEach((v) => add(v.word));
    (topic.idioms || []).forEach((v) => add(v.phrase));
  }
  const mat = path.join(ROOT, 'src/data/topicMaterials');
  for (const f of fs.readdirSync(mat)) {
    const d = JSON.parse(fs.readFileSync(path.join(mat, f), 'utf8'));
    for (const lv of ['A2', 'B1', 'B2']) (d.reading?.[lv]?.words || []).forEach((w) => add(w.phrase));
  }
  return out;
}

class QuotaError extends Error {}

// One request: the list, read with a long pause after every item. On the 2.5
// models the first line is taken as direction and not read out (checked by ear
// and by transcribing every clip — see the QA note at the bottom).
async function recordList(texts) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    signal: AbortSignal.timeout(120000), // a request that never answered once froze a run for half an hour
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Read this vocabulary list slowly and clearly, with a long pause between items:\n\n${texts.map((t) => `${t}.`).join('\n\n')}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) {
    if (/per_day/.test(j.error?.message || '')) throw new QuotaError(`daily quota of ${MODEL} used up — run again tomorrow`);
    const wait = Number(/"retryDelay":"(\d+)/.exec(JSON.stringify(j))?.[1] || 60);
    await new Promise((res) => setTimeout(res, wait * 1000));
    return null;
  }
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) return null;
  const buf = Buffer.from(part.inlineData.data, 'base64');
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000);
  return buf.slice(0, 4).toString() === 'RIFF' ? { wav: buf } : { pcm: buf, rate };
}

// Cut points: the middle of every pause of >= 0.6 s. Exactly texts.length - 1
// of them, or the batch is not trusted.
function cuts(wavPath) {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', wavPath, '-af', 'silencedetect=n=-40dB:d=0.6', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  // A pause at the very start or end is not a cut.
  return starts.map((s, i) => [s, ends[i]]).filter(([s, e]) => s > 0.05 && e !== undefined).map(([s, e]) => (s + e) / 2);
}

// Where the speech is between two cut points: the silences inside the piece
// (-40 dB, >= 0.1 s) are subtracted and specks shorter than 0.1 s (a breath, a
// click) are dropped, so the clip starts on the word and ends just after it.
function speechSpan(wavPath, from, to) {
  const total = (to ?? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wavPath]).toString())) - from;
  const log = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(from), '-t', String(total), '-i', wavPath,
    '-af', 'silencedetect=n=-40dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const sil = [];
  const re = /silence_(start|end): ([\d.]+)/g;
  let m; let open = null;
  while ((m = re.exec(log))) {
    if (m[1] === 'start') open = Number(m[2]);
    else { sil.push([open ?? 0, Number(m[2])]); open = null; }
  }
  if (open !== null) sil.push([open, total]);
  const speech = [];
  let t = 0;
  for (const [s, e] of sil) { if (s > t) speech.push([t, s]); t = Math.max(t, e); }
  if (t < total) speech.push([t, total]);
  const real = speech.filter(([s, e]) => e - s >= 0.1);
  if (!real.length) return null;
  return [Math.max(0, real[0][0] - 0.03), Math.min(total, real[real.length - 1][1] + 0.08)];
}

function clip(wavPath, from, to, mp3Path) {
  const span = speechSpan(wavPath, from, to);
  if (!span) return 0; // nothing but silence: the word is left for the next run
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(from + span[0]), '-t', String(span[1] - span[0]), '-i', wavPath,
    '-af', 'afade=t=in:d=0.01,loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '44100', '-b:a', '64k', mp3Path]);
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3Path]).toString());
}

async function accessToken() {
  const cliRoot = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib');
  const auth = require(path.join(cliRoot, 'auth.js'));
  const config = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json'), 'utf8'));
  return (await auth.getAccessToken(config.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])).access_token;
}

async function upload(token, object, buf) {
  const meta = { name: object, contentType: 'audio/mpeg', cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: TOKEN } };
  const boundary = 'b' + crypto.randomBytes(8).toString('hex');
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: audio/mpeg\r\n\r\n`),
    buf,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error(`upload ${object}: ${r.status} ${await r.text()}`);
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const lock = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : {};
  const all = terms();
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(slugOf)) : null;
  const todo = [...all]
    .filter(([slug, text]) => (only ? only.has(slug) : lock[slug]?.text !== text || lock[slug]?.model !== MODEL || !fs.existsSync(path.join(DIR, `${slug}.mp3`))))
    // Words with no file at all first; re-recording others in the new voice after.
    .sort((a, b) => Number(!!lock[a[0]]) - Number(!!lock[b[0]]));
  console.log(`${all.size} words and idioms, ${todo.length} to record (${MODEL}, ${VOICE}, ${BATCH} a request)`);

  const token = todo.length ? await accessToken() : null;
  const odd = [];
  let done = 0;
  try {
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH);
      const wavPath = path.join(DIR, '_batch.wav');
      let points = null;
      for (let attempt = 1; attempt <= 3 && !points; attempt++) {
        const got = await recordList(batch.map(([, t]) => t)).catch((e) => { if (e instanceof QuotaError) throw e; return null; });
        if (!got) continue;
        if (got.wav) fs.writeFileSync(wavPath, got.wav);
        else execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', String(got.rate), '-ac', '1', '-i', 'pipe:0', wavPath], { input: got.pcm });
        const c = cuts(wavPath);
        if (c.length === batch.length - 1) points = c;
        else console.warn(`  batch ${i / BATCH + 1}: ${c.length + 1} clips for ${batch.length} words, asking again`);
      }
      if (!points) { console.warn(`  ! skipped: ${batch.map(([, t]) => t).join(', ')}`); continue; }
      const bounds = [0, ...points];
      for (let k = 0; k < batch.length; k++) {
        const [slug, text] = batch[k];
        const mp3Path = path.join(DIR, `${slug}.mp3`);
        const sec = clip(wavPath, bounds[k], bounds[k + 1], mp3Path);
        if (!sec) { console.warn(`  ! no speech for ${text}`); continue; }
        if (sec > 1.2 + 0.6 * text.split(/\s+/).length || sec < 0.25) odd.push(`${text} (${sec.toFixed(2)} s)`);
        const buf = fs.readFileSync(mp3Path);
        await upload(token, `pronounce/${slug}.mp3`, buf);
        lock[slug] = { text, sha: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16), sec: Math.round(sec * 100) / 100, model: MODEL };
        done++;
      }
      fs.writeFileSync(LOCK, JSON.stringify(lock, null, 1));
      if (process.env.KEEP) fs.copyFileSync(wavPath, path.join(DIR, `_batch${i / BATCH + 1}.wav`));
      fs.unlinkSync(wavPath);
      console.log(`  ${done} done`);
    }
  } catch (e) {
    if (!(e instanceof QuotaError)) throw e;
    console.warn(`  ${e.message}`);
  }

  fs.writeFileSync(LOCK, JSON.stringify(lock, null, 1));
  const slugs = Object.keys(lock).filter((s) => all.has(s)).sort();
  fs.writeFileSync(OUT, `${JSON.stringify({ voice: VOICE, slugs })}\n`);
  console.log(`${slugs.length} published → src/data/pronunciations.json`);
  if (odd.length) console.warn(`check these (unusual length):\n  ${odd.join('\n  ')}`);
})().catch((e) => { console.error(e.message); process.exit(1); });

// QA (2026-10-13): every clip was transcribed back with gemini-3.8-flash and
// compared with its word; differences were spelling only (colours/colors).
