// One-off (2026-11-11): the teacher's copies for reports written before
// "the teacher sees types, never the conversation" (docs/domain/calls.md).
// Deterministic — no AI, nothing regenerated:
//   callAnalysis/{id} (done)          → callAnalysisTeacher/{id}: pattern + count, no quote, no rule
//   users/{uid}/insights/progress     → users/{uid}/insights/teacherProgress: carry-over examples dropped
//   homework/{id} (teacher-readable)  → personal theme examples + rules, word examples and the
//                                       word-order sentences (often the learner's own corrected
//                                       sentence) removed; topic steps and multiple choice kept
// Dry-run by default; --apply writes. Uses the firebase-tools CLI login, like
// repair-practice-stats.cjs.
const path = require('path');
const fs = require('fs');
const { firestoreRest } = require('./firestore-rest.cjs');
const privacy = require('../functions/analysisPrivacy');

const apply = process.argv.includes('--apply');

function scrubHomework(hw) {
  const p = hw && hw.personal;
  if (!p || typeof p !== 'object') return null;
  const themes = Array.isArray(p.themes) ? p.themes : [];
  const words = Array.isArray(p.words) ? p.words : [];
  const wordOrder = Array.isArray(p.wordOrder) ? p.wordOrder : [];
  const dirty = themes.some((t) => (t.examples || []).length || t.rule)
    || words.some((w) => w.example) || wordOrder.length;
  if (!dirty) return null;
  return {
    ...p,
    themes: themes.map((t) => ({ ...t, rule: '', examples: [] })),
    words: words.map((w) => ({ ...w, example: '' })),
    wordOrder: [],
  };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json'), 'utf8'));
  const cli = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));
  const token = await cli.getAccessToken(config.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  const db = firestoreRest(token.access_token, 'speak2them-64f2b');

  const reports = (await db.collection('callAnalysis').get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => a.status === 'done' && typeof a.userId === 'string' && a.userId);
  const uids = [...new Set(reports.map((a) => a.userId))];
  const homework = (await db.collection('homework').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const hwFix = homework.map((h) => ({ id: h.id, personal: scrubHomework(h) })).filter((h) => h.personal);

  // Self-check before anything is written: no projection may carry a quote.
  let leaks = 0;
  const projections = reports.map((a) => {
    const t = privacy.teacherAnalysis(a);
    const s = JSON.stringify(t);
    for (const q of privacy.rawQuotes(a)) if (q.length > 12 && s.includes(q)) leaks += 1;
    return { id: a.id, data: t };
  });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', reports: reports.length, learners: uids.length, homeworkToScrub: hwFix.length, leaks }));
  if (leaks) throw new Error('a projection still quotes the learner — nothing written');
  if (!apply) return;

  let wrote = 0;
  for (const p of projections) {
    await db.runTransaction(async (tx) => tx.set(db.doc(`callAnalysisTeacher/${p.id}`), p.data));
    wrote += 1;
  }
  let progress = 0;
  for (const uid of uids) {
    const snap = await db.doc(`users/${uid}/insights/progress`).get();
    if (!snap.exists) continue;
    const tp = privacy.teacherProgress(snap.data());
    delete tp.updatedAt;
    await db.runTransaction(async (tx) => tx.set(db.doc(`users/${uid}/insights/teacherProgress`), tp));
    progress += 1;
  }
  for (const h of hwFix) {
    await db.runTransaction(async (tx) => tx.set(db.doc(`homework/${h.id}`), { personal: h.personal }, { merge: true }));
  }
  console.log(JSON.stringify({ teacherAnalyses: wrote, teacherProgress: progress, homeworkScrubbed: hwFix.length }));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
