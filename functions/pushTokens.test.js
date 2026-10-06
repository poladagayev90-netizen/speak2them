const test = require('node:test');
const assert = require('node:assert');
const { buildMessage, ringsNatively } = require('./pushTokens');

const call = { type: 'incoming_call', title: 'Leyla is calling', body: 'Tap to answer', url: '/' };

test('only an Android app that says it can ring gets a data-only call', () => {
  assert.strictEqual(ringsNatively({ platform: 'android', caps: ['ring'] }), true);
  assert.strictEqual(ringsNatively({ platform: 'android' }), false);
  assert.strictEqual(ringsNatively({ platform: 'web', caps: ['ring'] }), false);

  const ring = buildMessage('android-ring', ['t'], call);
  assert.strictEqual(ring.notification, undefined);
  assert.strictEqual(ring.android.priority, 'high');
  assert.strictEqual(ring.android.notification, undefined);

  // Old APKs keep the visible notification, or they would show nothing.
  const old = buildMessage('android', ['t'], call);
  assert.strictEqual(old.notification.title, 'Leyla is calling');
  assert.strictEqual(old.android.notification.tag, 'call');
});

test('other pushes to a ringing-capable app are unchanged', () => {
  const m = buildMessage('android-ring', ['t'], { type: 'missed_call', title: 'Missed', body: '' });
  assert.strictEqual(m.notification.title, 'Missed');
  assert.strictEqual(m.android.notification.tag, 'call');
  assert.ok(buildMessage('web', ['t'], call).webpush);
});
