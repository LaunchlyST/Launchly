// Isolated contract tests: synthetic upstream fixtures exist only in this test file.
// They are never shipped, displayed in the app, or used as a runtime fallback.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
const compile = async entry => {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const { default: worker } = await compile('subscription-backend/worker/src/index.ts');
const client = await compile('subscription-backend/worker/src/services/creator-provider.ts');
const plan = await compile('subscription-backend/worker/src/services/creator-plan.ts');
const contract = await compile('shared/creator-contract.ts');
const env = { CREATOR_DATA_API_KEY: 'TEST_ONLY_NOT_A_REAL_KEY', SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'TEST_ONLY_SERVICE_ROLE', STRIPE_PRICE_ID: 'price_creator_monthly', STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture' };
const userId = '11111111-1111-4111-8111-111111111111';
const creatorId = '1234567890123456789';
let upstreamCalls, cached, auth, subscribed, upstreamFailure, expiredSubscription, malformed, limited, requests, missingDatabase, planVerified, subscriptionPrice;
function reset() {
  upstreamCalls = 0; cached = new Map(); auth = subscribed = true; upstreamFailure = expiredSubscription = malformed = limited = missingDatabase = false; requests = [];
  planVerified = true; subscriptionPrice = env.STRIPE_PRICE_ID;
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const body = init.body ? JSON.parse(init.body) : undefined;
  requests.push({ url, init, body });
  if (url.hostname === 'database.example') {
    if (url.pathname === '/auth/v1/user') return auth ? json({ id: userId, aud: 'authenticated' }) : json({ message: 'Invalid token' }, 401);
    if (url.pathname.endsWith('/users')) return json(subscribed ? [{ id: userId, subscription_status: 'active', subscription_price_id: subscriptionPrice, creator_api_plan_verified: planVerified, subscription_current_period_end: new Date(Date.now() + (expiredSubscription ? -1 : 3600000)).toISOString() }] : [{ subscription_status: 'inactive' }]);
    if (url.pathname.endsWith('/rpc/acquire_creator_request')) return missingDatabase ? json({ message: 'Missing migration' }, 404) : json(limited ? null : userId);
    if (url.pathname.endsWith('/creator_request_leases')) return json(null);
    if (url.pathname.endsWith('/creator_api_cache')) {
      if (missingDatabase) return json({ message: 'Missing migration' }, 404);
      if (init.method === 'POST') { cached.set(body.cache_key, body); return json(null, 201); }
      const key = url.searchParams.get('cache_key')?.replace(/^eq\./, '');
      return json(cached.has(key) ? [cached.get(key)] : []);
    }
    throw Error('Unexpected database request: ' + url.pathname);
  }
  assert.equal(url.hostname, 'www.kalodata.com');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['secret-key'], env.CREATOR_DATA_API_KEY);
  assert.equal(init.redirect, 'error');
  assert.equal(body.region, 'GB'); assert.equal(body.currency, 'GBP');
  upstreamCalls++;
  if (upstreamFailure) return json({ leaked_key: env.CREATOR_DATA_API_KEY, message: 'private upstream error' }, 503);
  if (malformed) return json({ success: true, data: { unexpected: true } });
  const row = { creator_id: creatorId, creator_handle: '@fixture', creator_nickname: 'Test fixture', creator_followers: '1250', revenue: '123.45', private_field: 'MUST_NOT_REACH_BROWSER' };
  if (url.pathname.endsWith('/creator/rank')) {
    assert.equal(body.page_number, 1); assert.equal(body.page_size, 20);
    return json({ success: true, data: body.keyword === 'nonexistent' ? [] : [row] });
  }
  if (url.pathname.endsWith('/creator/detailByHandle')) { assert.equal(body.date_range, 'last365Day'); assert.equal(body.creator_handle, 'fixture'); return json({ success: true, data: row }); }
  if (url.pathname.endsWith('/creator/detail')) return json({ success: true, data: { ...row, creator_bio: 'Test fixture bio' } });
  if (url.pathname.endsWith('/product/rank')) { assert.equal(body.creator_id, creatorId); return json({ success: true, data: [{ product_id: '123', product_name: 'Fixture product', sales_volumn: '2', commission_rate: '0.1' }] }); }
  if (url.pathname.endsWith('/video/rank')) { assert.equal(body.creator_id, creatorId); return json({ success: true, data: [{ video_id: '456', video_title: 'Fixture video', digg_count: '10', share_count: '3', comment_count: '2' }] }); }
  throw Error('Undocumented upstream endpoint: ' + url.pathname);
};
async function request(path = 'search?q=fixture', options = {}) {
  const response = await worker.fetch(new Request('https://launchly.example/api/launchly/creators/' + path, { headers: options.loggedOut ? {} : { Authorization: 'Bearer TEST_USER_TOKEN' } }), options.env || env);
  const raw = await response.text();
  assert.ok(!raw.includes(env.CREATOR_DATA_API_KEY)); assert.ok(!raw.includes(env.SUPABASE_SERVICE_ROLE_KEY));
  assert.ok(!raw.includes('MUST_NOT_REACH_BROWSER')); assert.ok(!raw.includes('kalodata'));
  const body = JSON.parse(raw); assert.equal(body.service, 'Launchly Creator API');
  return { status: response.status, body };
}

test('username, @username and profile URL normalize to the same cached GB search', async () => {
  reset();
  for (const q of ['fixture', ' @Fixture ', 'https://www.tiktok.com/@Fixture?lang=en']) {
    const result = await request('search?q=' + encodeURIComponent(q));
    assert.equal(result.status, 200); const c = result.body.data.creators[0];
    assert.equal(c.username, 'fixture'); assert.equal(c.followers, 1250); assert.equal(c.gmv, 123.45);
    assert.equal(c.likes, null); assert.equal(c.productCount, null); assert.equal(c.region, 'GB');
  }
  assert.equal(upstreamCalls, 1); assert.equal(cached.size, 1);
  const cachedRow = [...cached.values()][0];
  assert.ok(Date.parse(cachedRow.expires_at) - Date.parse(cachedRow.created_at) >= 6 * 3600000 - 50);
});
test('authentication and paid entitlement are checked before cache/upstream', async () => {
  reset(); assert.equal((await request()).status, 200); upstreamCalls = 0;
  assert.equal((await request(undefined, { loggedOut: true })).status, 401);
  auth = false; assert.equal((await request()).status, 401); auth = true;
  subscribed = false; assert.equal((await request()).status, 403); subscribed = true;
  expiredSubscription = true; assert.equal((await request()).status, 403);
  assert.equal(upstreamCalls, 0);
});
test('empty, invalid market, invalid pagination and unsupported rank periods are rejected', async () => {
  reset();
  for (const path of ['search', 'search?q=@', 'search?q=test&region=ZZ', 'search?q=test&page=0', 'search?q=test&page=6', 'search?q=test&pageSize=200', 'search?q=test&period=60', 'search?q=' + 'a'.repeat(65)]) assert.equal((await request(path)).status, 400);
  assert.equal(upstreamCalls, 0);
});
test('genuine empty search is distinct from upstream failure or malformed data', async () => {
  reset(); const empty = await request('search?q=nonexistent'); assert.equal(empty.status, 200); assert.deepEqual(empty.body.data.creators, []);
  upstreamFailure = true; assert.equal((await request()).body.error.code, 'UPSTREAM_ERROR');
  upstreamFailure = false; malformed = true; assert.equal((await request()).status, 502);
});
test('missing key and missing database setup fail explicitly with no upstream call', async () => {
  reset(); const original = console.error; const logs = []; console.error = message => logs.push(message);
  try { assert.equal((await request(undefined, { env: { ...env, CREATOR_DATA_API_KEY: '' } })).status, 503); } finally { console.error = original; }
  assert.deepEqual(logs, ['Launchly Creator API: CREATOR_DATA_API_KEY is not configured.']); assert.equal(upstreamCalls, 0);
  missingDatabase = true; assert.equal((await request()).status, 503); assert.equal(upstreamCalls, 0);
});
test('recent stale data is served only for temporary upstream failure and bounded to 24h', async () => {
  reset(); await request(); const row = [...cached.values()][0];
  row.expires_at = new Date(Date.now() - 1000).toISOString(); upstreamFailure = true;
  const stale = await request(); assert.equal(stale.status, 200); assert.equal(stale.body.stale, true);
  row.expires_at = new Date(Date.now() - 25 * 3600000).toISOString(); assert.equal((await request()).status, 502);
});
test('rate limit prevents upstream calls and status reports only safe configuration', async () => {
  reset(); limited = true; assert.equal((await request()).status, 429); assert.equal(upstreamCalls, 0);
  const status = await request('status'); assert.deepEqual(status.body, { success: true, service: 'Launchly Creator API', status: 'online' });
});
test('detail, products and videos use documented endpoints and normalize only supported fields', async () => {
  reset();
  const detail = await request(creatorId); assert.equal(detail.status, 200); assert.equal(detail.body.data.bio, 'Test fixture bio'); assert.equal(detail.body.data.updatedAt, null);
  const products = await request(creatorId + '/products'); assert.equal(products.body.data.products[0].itemsSold, 2); assert.equal(products.body.data.products[0].image, null);
  const videos = await request(creatorId + '/videos'); assert.equal(videos.body.data.videos[0].likes, 10); assert.equal(videos.body.data.videos[0].itemsSold, null);
  assert.equal(cached.size, 3); assert.equal(upstreamCalls, 3);
  const productCache = [...cached.values()].find(row => row.endpoint === 'products'); assert.ok(Date.parse(productCache.expires_at) - Date.parse(productCache.created_at) <= 3 * 3600000 + 50);
  assert.equal((await request(creatorId + '?period=90')).status, 200);
  assert.equal((await request(creatorId + '/products?period=90')).status, 400);
});
test('IDs retain precision, numeric absence is never silently converted to zero', () => {
  for (const value of [null, undefined, '', ' ', true, {}, 'unknown', Infinity]) assert.equal(client.numeric(value), null);
  assert.equal(client.numeric('0'), 0);
  assert.throws(() => client.normalizeCreator({ creator_id: 1234567890123456789, creator_handle: '@test' }, 'GB', 'GBP'));
  assert.equal(contract.validCreatorQuery('https://evil.example/@user'), false);
  assert.equal(contract.normalizeCreatorQuery('https://www.tiktok.com/@USER'), 'user');
});

test('one-year searches use handle detail with the actual requested period', async () => {
  reset(); const result = await request('search?q=@fixture&period=365');
  assert.equal(result.status, 200); assert.equal(result.body.data.creators[0].username, 'fixture');
  assert.equal(result.body.data.pagination.hasMore, false); assert.equal(upstreamCalls, 1);
  assert.equal((await request(creatorId + '?period=365')).status, 200);
  assert.equal((await request('search?q=fixture&period=366')).status, 400);
});

const planPrice = { id: 'price_creator_monthly', currency: 'gbp', unit_amount: 500, type: 'recurring', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
test('only the verified five-pound monthly plan grants access', async () => {
  reset(); planVerified = false; assert.equal((await request()).status, 403);
  planVerified = true; subscriptionPrice = 'price_other'; assert.equal((await request()).status, 403);
  assert.equal(upstreamCalls, 0);
  assert.equal(plan.isLaunchlyCreatorPrice(planPrice, env.STRIPE_PRICE_ID), true);
  for (const price of [{ ...planPrice, unit_amount: 1000 }, { ...planPrice, currency: 'usd' }, { ...planPrice, recurring: { ...planPrice.recurring, interval: 'year' } }, { ...planPrice, recurring: { ...planPrice.recurring, interval_count: 2 } }]) {
    assert.equal(plan.isLaunchlyCreatorPrice(price, env.STRIPE_PRICE_ID), false);
  }
});
test('signed Stripe webhook records the actual plan and rejects tampered signatures', async () => {
  reset();
  const payload = JSON.stringify({ id: 'evt_fixture', type: 'customer.subscription.updated', data: { object: { id: 'sub_fixture', customer: 'cus_fixture', status: 'active', current_period_end: Math.floor(Date.now()/1000) + 3600, items: { data: [{ quantity: 1, price: planPrice }] } } } });
  const timestamp = Math.floor(Date.now()/1000);
  const signature = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(timestamp + '.' + payload).digest('hex');
  const response = await worker.fetch(new Request('https://launchly.example/api/webhook', { method: 'POST', headers: { 'stripe-signature': 't=' + timestamp + ',v1=' + signature }, body: payload }), env);
  assert.equal(response.status, 200);
  const write = requests.find(r => r.url.pathname.endsWith('/users') && r.init.method === 'PATCH');
  assert.ok(write, 'verified webhook must update billing');
  assert.equal(write.body.creator_api_plan_verified, true); assert.equal(write.body.subscription_price_id, env.STRIPE_PRICE_ID);
  const originalError = console.error; console.error = () => {};
  try {
    const bad = await worker.fetch(new Request('https://launchly.example/api/webhook', { method: 'POST', headers: { 'stripe-signature': 't=' + timestamp + ',v1=bad' }, body: payload }), env);
    assert.equal(bad.status, 400);
  } finally { console.error = originalError; }
});
