const test = require('node:test');
const assert = require('node:assert');
const { Timestamp } = require('firebase-admin/firestore');
const { callLogDoc, kindOf } = require('./callLog');

const T = 1760000000000;
const call = (over = {}) => ({
  connectedAt: Timestamp.fromMillis(T), endedAt: Timestamp.fromMillis(T + 10 * 60000), authoritativeDurationSec: 600, source: 'weekly_plan', ...over,
});

test('one line per call, both people, sorted, with their names', () => {
  const line = callLogDoc({ callId: 'call_a_b', call: call(), participants: ['b', 'a'], names: { a: 'Aysel', b: 'Murad' } });
  assert.strictEqual(line.id, `call_a_b_${T}`);
  assert.deepStrictEqual(line.data.participants, ['a', 'b']);
  assert.deepStrictEqual(line.data.names, { a: 'Aysel', b: 'Murad' });
  assert.strictEqual(line.data.seconds, 600);
  assert.strictEqual(line.data.kind, 'plan');
});

test('ringing, missing times or one person make no line', () => {
  assert.strictEqual(callLogDoc({ callId: 'c', call: call({ authoritativeDurationSec: 3 }), participants: ['a', 'b'] }), null);
  assert.strictEqual(callLogDoc({ callId: 'c', call: call({ endedAt: null }), participants: ['a', 'b'] }), null);
  assert.strictEqual(callLogDoc({ callId: 'c', call: call(), participants: ['a', 'a'] }), null);
});

test('a call with no booking behind it is direct', () => {
  assert.strictEqual(kindOf(undefined), 'direct');
  assert.strictEqual(kindOf('teacher_match'), 'teacher');
  assert.strictEqual(kindOf('admin_offer'), 'admin');
});
