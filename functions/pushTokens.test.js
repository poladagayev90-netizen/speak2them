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

test('a user with the Android app gets no push on their phone browser; computers stay', () => {
  const { dropMobileWebWhenNative } = require('./pushTokens');
  const phoneUa = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130 Mobile Safari/537.36';
  const deskUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36';
  const e = (uid, platform, userAgent) => ({ uid, platform, userAgent, token: `${uid}-${platform}-${userAgent ? userAgent.length : 0}` });
  const all = [
    e('a', 'android'), e('a', 'web', phoneUa), e('a', 'web', deskUa), e('a', 'web', null),
    e('b', 'web', phoneUa), // no native app: keeps its phone browser
  ];
  const kept = dropMobileWebWhenNative(all).map((x) => x.token);
  assert.deepStrictEqual(kept, [all[0], all[2], all[3], all[4]].map((x) => x.token));
});

test('a reminder carries its own TTL and tag; web stays data-only', () => {
  const r = { type: 'call_reminder', title: 'Practice', body: '', ttl: '600', tag: 'call_b1' };
  const web = buildMessage('web', ['t'], r);
  assert.strictEqual(web.webpush.headers.TTL, '600');
  assert.strictEqual(web.notification, undefined);
  const android = buildMessage('android', ['t'], r);
  assert.strictEqual(android.android.ttl, 600000);
  assert.strictEqual(android.android.notification.tag, 'call_b1');
  // Without a ttl the old defaults stand.
  assert.strictEqual(buildMessage('web', ['t'], { type: 'x' }).webpush.headers.TTL, '3600');
  assert.strictEqual(buildMessage('android', ['t'], { type: 'x' }).android.ttl, undefined);
});
