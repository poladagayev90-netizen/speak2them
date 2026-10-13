const test = require('node:test');
const assert = require('node:assert');
const { buildPacket } = require('./packet');
const { parseAgentOutput } = require('./validate');
const { costUsd, callGemini } = require('./gemini');

const learners = [
  { uid: 'uA', name: 'Aysel', level: 'B1 – Intermediate', need: 2, committed: true },
  { uid: 'uB', name: 'Tural', level: 'B2', need: 1, committed: false },
  { uid: 'uC', name: 'Nigar', level: 'A2', need: 1, committed: true },
];
const candidates = [
  { key: 'uA|uB', a: 'uA', b: 'uB', shared: ['2026-10-19-20', '2026-10-21-20'] },
  { key: 'uA|uC', a: 'uA', b: 'uC', shared: ['2026-10-19-19'] },
];

test('the packet carries aliases and numbers, never names or uids', () => {
  const signals = new Map([['uA', { health: 'active', calls: 5, attended: 2, noShow: 1, tags: { on_time: 2 } }]]);
  const pairSignals = new Map([['uA|uB', { fav: 1, tagsAB: ['respectful', 'bogus'] }]]);
  const { packet, alias, uidOf, pairIndex } = buildPacket({ learners, candidates, signals, pairSignals });
  const text = JSON.stringify(packet);
  for (const leak of ['Aysel', 'Tural', 'Nigar', 'uA', 'uB', 'uC']) assert.ok(!text.includes(leak), leak);
  assert.strictEqual(alias.get('uA'), 'L1');
  assert.strictEqual(uidOf.get('L3'), 'uC');
  assert.strictEqual(packet.people[0].level, 'B1');
  assert.strictEqual(packet.people[0].last_28_days.no_show, 1);
  const p1 = packet.pairs.find((p) => pairIndex.get(p.id) === 'uA|uB');
  assert.deepStrictEqual(p1.a_said_of_b, ['respectful']);
  assert.strictEqual(p1.starred, 1);
  assert.strictEqual(p1.shared_days, 2);
});

test('each learner keeps only their top candidates', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ uid: `u${i}`, level: 'B1', need: 1 }));
  const cands = [];
  for (let i = 1; i < 12; i++) cands.push({ key: `u0|u${i}`, a: 'u0', b: `u${i}`, shared: ['2026-10-19-20'] });
  const { packet } = buildPacket({ learners: many, candidates: cands, perPerson: 3 });
  // u0's top 3, plus every other learner keeps their only pair → all 11 stay.
  assert.strictEqual(packet.pairs.length, 11);
  const { packet: p2 } = buildPacket({ learners: many, candidates: cands.map((c) => ({ ...c })), perPerson: 0 });
  assert.strictEqual(p2.pairs.length, 0);
});

test('the answer is clamped, unknown ids are dropped, aliases become names', () => {
  const { pairIndex, uidOf } = buildPacket({ learners, candidates });
  const out = parseAgentOutput({
    pairs: [{ id: 'p1', score: 7, why: 'praised each other' }, { id: 'p99', score: 1, why: 'x' }, { id: 'p2', score: -0.6, why: 'L3 had no-shows' }, { id: 'p2', score: 2, why: 'dup' }],
    flags: [{ person: 'L2', why: 'never answers' }, { person: 'L9', why: 'unknown' }],
    report: 'L1 iki dəfə gəldi, L12 yoxdur. L3 yeni.',
  }, { pairIndex, uidOf, nameOf: (u) => ({ uA: 'Aysel', uC: 'Nigar' }[u]) });
  assert.deepStrictEqual(out.aiBonus.get('uA|uB'), { score: 2, why: 'praised each other' });
  assert.deepStrictEqual(out.aiBonus.get('uA|uC'), { score: -0.5, why: 'Nigar had no-shows' });
  assert.strictEqual(out.aiBonus.size, 2);
  assert.deepStrictEqual(out.flags, [{ uid: 'uB', why: 'never answers' }]);
  assert.strictEqual(out.report, 'Aysel iki dəfə gəldi, L12 yoxdur. Nigar yeni.');
  assert.ok(out.dropped >= 2);
});

test('garbage in, nothing out', () => {
  const { pairIndex, uidOf } = buildPacket({ learners, candidates });
  const out = parseAgentOutput(null, { pairIndex, uidOf });
  assert.strictEqual(out.aiBonus.size, 0);
  assert.deepStrictEqual(out.flags, []);
  assert.strictEqual(out.report, '');
});

test('cost counts thinking as output and doubles in 2027', () => {
  const u = { promptTokenCount: 1e6, candidatesTokenCount: 5e5, thoughtsTokenCount: 5e5 };
  assert.strictEqual(costUsd(u, 'gemini-3.8-flash', Date.parse('2026-10-14')).usd, 0.75 + 3.75);
  assert.strictEqual(costUsd(u, 'gemini-3.8-flash', Date.parse('2027-01-02')).usd, 1.5 + 7.5);
});

test('a 429 is retried once, then the call fails cleanly', async () => {
  let n = 0;
  const fetchImpl = async () => { n += 1; return { status: 429, ok: false, text: async () => '' }; };
  await assert.rejects(callGemini({ apiKey: 'k', model: 'm', system: 's', prompt: 'p', schema: {}, fetchImpl }), /gemini-429/);
  assert.strictEqual(n, 2);
  const ok = async () => ({ status: 200, ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pairs":[],"flags":[],"report":"ok"}' }] } }], usageMetadata: { promptTokenCount: 10 } }) });
  const r = await callGemini({ apiKey: 'k', model: 'm', system: 's', prompt: 'p', schema: {}, fetchImpl: ok });
  assert.strictEqual(r.json.report, 'ok');
  await assert.rejects(callGemini({ apiKey: '', model: 'm', system: 's', prompt: 'p', schema: {} }), /gemini-no-key/);
});
