// Generates "describe the video" clips with Veo through the Gemini API, paid from the
// billing account the key belongs to (GDP credits first):
//   node scripts/veo-clips.cjs                 (every scene below that has no file yet)
//   node scripts/veo-clips.cjs seagull-pizza   (one scene, again)
//   VEO_MODEL=veo-3.1-lite-generate-preview node scripts/veo-clips.cjs …
// Writes video_review/veo/<id>.mp4 (8 s, 16:9, 720p). Then review them and ingest with
// scripts/ingest_videos.js — every clip made here is `licensed: true, ai: true`.
//
// The deck rule (Polad, 2026-09-25): a SMALL STORY with a surprise or a reaction — never
// plain action. No speech and no on-screen text: a voice or a caption would describe the
// clip for the learner.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'video_review/veo');
const MODEL = process.env.VEO_MODEL || 'veo-3.1-fast-generate-preview';
const KEY = (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m) || [])[1]?.replace(/["\r\s]/g, '');
if (!KEY) throw new Error('GEMINI_API_KEY missing in .env');
const API = 'https://generativelanguage.googleapis.com/v1beta';

const LOOK = 'Realistic amateur video, looks like a real moment caught on camera, natural light, slightly shaky, no music, no speech, no talking, no text, no captions, no watermark. Only natural sounds.';
const SCENES = [
  ['seagull-pizza', 'Doorbell camera view, wide angle, of a front doorstep on a sunny day. A pizza delivery box lies on the doormat. A big seagull lands, pushes the lid open with its beak, grabs a whole slice of pizza and flies away with it, leaving the box open.'],
  ['dog-cushion-caught', 'Home security camera in a living room. A dog alone at home pulls a big cushion off the sofa and starts shaking it, feathers fly. The front door opens, the dog freezes, then slowly lies down and looks away as if nothing happened.'],
  ['cat-glass-push', 'Phone video of a kitchen table. A cat sits next to a full glass of water, looks straight at the camera, then slowly pushes the glass with its paw towards the edge, step by step, until it falls off the table.'],
  ['goat-car-roof', 'Phone video in a farmyard. A goat jumps onto the bonnet of a small parked car, then climbs onto the roof and stands there proudly while a farmer in boots runs up waving his arms.'],
  ['robot-vacuum-cat', 'Phone video in a flat. A cat sits on a moving robot vacuum cleaner like a passenger. The robot bumps into a wall, turns suddenly, and the surprised cat slides off onto the floor.'],
  ['cake-dog-lick', 'Phone video in a kitchen. A birthday cake with candles stands on a low table. The people walk out of the room; a small dog jumps up, licks a big piece of cream off the top of the cake, then runs away when footsteps come back.'],
  ['waiter-tray-save', 'Phone video in a busy cafe. A waiter carries a tray full of glasses, trips on a bag on the floor, the glasses wobble and almost fall, and he catches every single one at the last second. People at the tables clap.'],
  ['umbrella-wind', 'Phone video on a windy rainy street. A man opens his umbrella, a strong gust turns it inside out and pulls it out of his hands; it flies down the street and he runs after it while his hat also blows away.'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function make(id, scene) {
  const res = await fetch(`${API}/models/${MODEL}:predictLongRunning`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      instances: [{ prompt: `${scene} ${LOOK}` }],
      parameters: { aspectRatio: '16:9', durationSeconds: 8, resolution: '720p', personGeneration: 'allow_all' },
    }),
  });
  let op = await res.json();
  if (!op.name) throw new Error(`${id}: ${res.status} ${JSON.stringify(op.error || op).slice(0, 300)}`);
  while (!op.done) {
    await sleep(10000);
    op = await (await fetch(`${API}/${op.name}`, { headers: { 'x-goog-api-key': KEY } })).json();
  }
  if (op.error) throw new Error(`${id}: ${JSON.stringify(op.error).slice(0, 300)}`);
  const sample = op.response?.generateVideoResponse?.generatedSamples?.[0];
  const uri = sample?.video?.uri;
  if (!uri) throw new Error(`${id}: no video (${JSON.stringify(op.response).slice(0, 300)})`);
  const vid = await fetch(uri, { headers: { 'x-goog-api-key': KEY }, redirect: 'follow' });
  const buf = Buffer.from(await vid.arrayBuffer());
  fs.writeFileSync(path.join(OUT, `${id}.mp4`), buf);
  console.log(`${id}: ${(buf.length / 1024) | 0} KB (${MODEL})`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const todo = SCENES.filter(([id]) => (only.length ? only.includes(id) : !fs.existsSync(path.join(OUT, `${id}.mp4`))));
  // Two at a time: Veo takes ~1–2 min per clip; more in parallel only meets the rate limit.
  for (let i = 0; i < todo.length; i += 2) {
    await Promise.all(todo.slice(i, i + 2).map(([id, s]) => make(id, s).catch((e) => console.error(e.message))));
  }
})();
