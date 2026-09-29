const test = require('node:test');
const assert = require('node:assert/strict');
const { ensurePostCallChat, chatIdFor } = require('./postCallChat');

function database(seed = []) {
  const data = new Map(seed);
  const db = {
    doc: (path) => ({ path }),
    runTransaction: async (f) => f({
      get: async (r) => ({ exists: data.has(r.path), data: () => data.get(r.path) }),
      set: (r, v) => data.set(r.path, v),
    }),
  };
  return { db, data };
}

test('a real call creates one chat both people can list, and retries do not touch it', async () => {
  const { db, data } = database();
  assert.equal(await ensurePostCallChat(db, ['zed', 'amy'], 610), 'created');
  const chat = data.get('chats/amy_zed');
  assert.deepEqual(chat.participants, ['amy', 'zed']);
  assert.equal(chat.lastMessage, 'You talked for 10 min — say hi');
  assert.deepEqual(chat.unread, {});
  assert.ok(chat.updatedAt);
  assert.equal(await ensurePostCallChat(db, ['amy', 'zed'], 610), 'exists');
  assert.equal(data.get('chats/amy_zed'), chat);
});

test('an existing conversation is left exactly as it was', async () => {
  const before = { participants: ['amy', 'zed'], lastMessage: 'see you friday' };
  const { db, data } = database([['chats/amy_zed', before]]);
  assert.equal(await ensurePostCallChat(db, ['amy', 'zed'], 300), 'exists');
  assert.equal(data.get('chats/amy_zed'), before);
});

test('a block or a "don\'t pair me again" either way means no chat', async () => {
  for (const guard of ['users/amy/blocked/zed', 'users/zed/blocked/amy', 'users/amy/avoid/zed', 'users/zed/avoid/amy']) {
    const { db, data } = database([[guard, {}]]);
    assert.equal(await ensurePostCallChat(db, ['amy', 'zed'], 300), 'blocked', guard);
    assert.equal(data.has('chats/amy_zed'), false);
  }
});

test('AInur and broken participant lists are skipped', async () => {
  const { db, data } = database();
  assert.equal(await ensurePostCallChat(db, ['amy', 'ainur'], 300), 'skipped');
  assert.equal(await ensurePostCallChat(db, ['amy'], 300), 'skipped');
  assert.equal(await ensurePostCallChat(db, ['amy', 'amy'], 300), 'skipped');
  assert.equal(data.size, 0);
});

test('the chat id matches the client (sorted uids joined by _)', () => {
  assert.equal(chatIdFor('zed', 'amy'), 'amy_zed');
});
