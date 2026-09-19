// Tiny local stand-in for the functions emulator: serves the REAL exported
// handlers from functions/index.js on :5002, with firebase-admin pointed at the
// Firestore + Auth emulators. (The functions emulator's own admin proxy lacks
// admin.firestore.FieldValue, which every write in this codebase uses.)
const http = require('http');
const PROJECT = 'demo-speaklab';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = PROJECT;
process.env.FUNCTIONS_EMULATOR = 'true';
const fns = require(require('path').join(__dirname, '..', 'functions', 'index.js'));

http.createServer((req, res) => {
  const name = req.url.split('?')[0].split('/').pop();
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', async () => {
    const wrap = {
      set(k, v) { res.setHeader(k, v); return wrap; },
      setHeader(k, v) { res.setHeader(k, v); return wrap; },
      header(k, v) { res.setHeader(k, v); return wrap; },
      status(c) { res.statusCode = c; return wrap; },
      json(b) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return wrap; },
      send(b) { res.end(typeof b === 'string' ? b : JSON.stringify(b ?? '')); return wrap; },
      end() { res.end(); return wrap; },
    };
    if (typeof fns[name] !== 'function') { wrap.status(404).json({ error: 'no-fn' }); return; }
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { /* keep {} */ }
    const r = { method: req.method, headers: req.headers, body, query: {} };
    console.log(req.method, name);
    try { await fns[name](r, wrap); } catch (e) { console.error(name, e.message); if (!res.writableEnded) wrap.status(500).json({ error: e.message }); }
  });
}).listen(5002, () => console.log('fn server on 5002'));
