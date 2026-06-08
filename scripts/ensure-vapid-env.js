const fs = require('fs');
const path = require('path');

const VAPID_KEY = process.argv[2];
if (!VAPID_KEY) {
  console.error('[ensure-vapid-env] Usage: node scripts/ensure-vapid-env.js <VAPID_KEY>');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');
const line = `REACT_APP_FIREBASE_VAPID_KEY=${VAPID_KEY}`;
const key = 'REACT_APP_FIREBASE_VAPID_KEY';

let content = '';
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf8');
  if (content.includes(`${key}=`)) {
    content = content
      .split('\n')
      .map((row) => (row.startsWith(`${key}=`) ? line : row))
      .join('\n');
  } else {
    content = content.trimEnd() + (content.endsWith('\n') || content.length === 0 ? '' : '\n') + line + '\n';
  }
} else {
  content = `${line}\n`;
}

fs.writeFileSync(envPath, content);
console.log('[ensure-vapid-env] Updated .env with VAPID key');
