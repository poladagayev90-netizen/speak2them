// Runs after every `npx cap copy` / `npx cap sync` (package.json
// "capacitor:copy:after"). Only the describe-video clips licensed for the Play
// Store (`licensed: true` in src/data/describeVideos.js — Pexels / CC0) may be
// inside the APK/AAB. Everything else under public/videos — the other clips
// and the film clips in videos/clips — is deleted from the copy of the web
// bundle that goes into the Android app. The app shows only the licensed
// clips there (videosForTopic in src/utils/fetchTopicVideos.js); this makes
// sure no other file is inside the package either.
const fs = require('fs');
const path = require('path');

const platform = process.env.CAPACITOR_PLATFORM_NAME;
if (platform && platform !== 'android') process.exit(0);

const root = path.join(__dirname, '..');
const dir = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public', 'videos');
if (!fs.existsSync(dir)) {
  console.log('[strip-native-videos] no videos folder in the Android bundle');
  process.exit(0);
}

// The deck is an ES module; read the licensed entries' files out of its text.
// Each entry is one `{ ... }` block; keep the src/poster of those that say
// `licensed: true`.
const deck = fs.readFileSync(path.join(root, 'src', 'data', 'describeVideos.js'), 'utf8').replace(/\r\n/g, '\n');
const keep = new Set();
for (const block of deck.split(/\n  \{\n/).slice(1)) {
  if (!/\n\s+licensed: true,/.test(block)) continue;
  for (const m of block.matchAll(/\n\s+(?:src|poster): '\/videos\/([^']+)'/g)) keep.add(m[1]);
}
if (keep.size === 0) {
  // A parsing slip must not ship every clip: fail loudly instead.
  console.error('[strip-native-videos] found no licensed clips — refusing to guess; check describeVideos.js');
  process.exit(1);
}

let removed = 0;
let kept = 0;
for (const name of fs.readdirSync(dir)) {
  const p = path.join(dir, name);
  if (fs.statSync(p).isFile() && keep.has(name)) { kept += 1; continue; }
  fs.rmSync(p, { recursive: true, force: true });
  removed += 1;
}
console.log(`[strip-native-videos] kept ${kept} licensed files, removed ${removed} other entries from ${path.relative(process.cwd(), dir)}`);
