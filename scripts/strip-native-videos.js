// Runs after every `npx cap copy` / `npx cap sync` (package.json
// "capacitor:copy:after"). The describe-video clips are web-only — they are not
// licensed for the Play Store build — so they are deleted from the copy of the
// web bundle that goes into the APK/AAB. The app itself hides every video entry
// point on native (VIDEOS_ENABLED in src/utils/fetchTopicVideos.js); this makes
// sure the files are not inside the package either.
const fs = require('fs');
const path = require('path');

const platform = process.env.CAPACITOR_PLATFORM_NAME;
if (platform && platform !== 'android') process.exit(0);

const dir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public', 'videos');
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('[strip-native-videos] removed', path.relative(process.cwd(), dir));
} else {
  console.log('[strip-native-videos] no videos folder in the Android bundle');
}
