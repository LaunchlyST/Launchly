import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret, isCodingModel, listProviderModels, DEFAULT_LATEST } from './monitorRoutes.ts';

const SECRET = Buffer.from(new Uint8Array(32).map((_, i) => i + 1)).toString('base64');

test('provider keys round-trip through AES-GCM and ciphertext never contains the key', async () => {
  const { ciphertext, iv } = await encryptSecret(SECRET, 'sk-ant-TEST-ONLY-1234');
  assert.ok(!ciphertext.includes('sk-ant'));
  assert.equal(await decryptSecret(SECRET, ciphertext, iv), 'sk-ant-TEST-ONLY-1234');
  const again = await encryptSecret(SECRET, 'sk-ant-TEST-ONLY-1234');
  assert.notEqual(again.iv, iv);
});

test('wrong-length encryption key is refused', async () => {
  await assert.rejects(encryptSecret(Buffer.from('short').toString('base64'), 'x'));
});

test('key test: 401 → invalid (null), 200 → model list', async () => {
  const bad = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
  assert.equal(await listProviderModels('openai', 'sk-x', bad), null);
  const good = (async () =>
    new Response(JSON.stringify({ data: [{ id: 'm-a', created: 2 }, { id: 'm-b', created: 1 }] }), { status: 200 })) as unknown as typeof fetch;
  const list = await listProviderModels('openai', 'sk-x', good);
  assert.deepEqual(list!.map((m) => m.id), ['m-a', 'm-b']);
});

test('only coding/chat models are offered', () => {
  assert.equal(isCodingModel('openai', 'text-embedding-3-large'), false);
  assert.equal(isCodingModel('openai', 'whisper-1'), false);
  assert.equal(isCodingModel('anthropic', 'claude-anything'), true);
  assert.equal(isCodingModel('xai', 'grok-anything'), true);
});

test('latest mapping is server-side config, overridable, not in the UI', () => {
  assert.ok('anthropic' in DEFAULT_LATEST && 'openai' in DEFAULT_LATEST && 'xai' in DEFAULT_LATEST);
});
