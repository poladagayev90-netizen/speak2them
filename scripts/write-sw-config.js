const fs = require('fs');
const path = require('path');

// The messaging service worker cannot read the app bundle's env, so this
// script materialises the Firebase config into public/firebase-sw-config.js
// before every start/build. It must work in all three environments:
//   - Vercel/CI builds: vars come from process.env (dashboard settings)
//   - local dev: .env (gitignored)
//   - any build machine without either: .env.production (committed)
// Reading only .env used to leave the production file EMPTY on Vercel, which
// crashed the messaging SW and silently killed every push notification.

function parseEnvFile(file) {
  const envPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

const fileVars = { ...parseEnvFile('.env.production'), ...parseEnvFile('.env') };
const get = (key) => process.env[key] || fileVars[key];

const config = {
  apiKey: get('REACT_APP_FIREBASE_API_KEY'),
  authDomain: get('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: get('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: get('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: get('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: get('REACT_APP_FIREBASE_APP_ID'),
};

// An incomplete config produces a service worker that throws at install time,
// which disables push for every user of that deploy. Fail the build instead.
const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('[write-sw-config] FATAL: missing Firebase config values:', missing.join(', '));
  console.error('[write-sw-config] Set REACT_APP_FIREBASE_* in the environment, .env, or .env.production.');
  process.exit(1);
}

const outPath = path.join(__dirname, '..', 'public', 'firebase-sw-config.js');
fs.writeFileSync(outPath, `self.FIREBASE_SW_CONFIG = ${JSON.stringify(config)};\n`);
console.log('[write-sw-config] Wrote', outPath);
