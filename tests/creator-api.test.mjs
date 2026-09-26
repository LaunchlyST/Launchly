import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { test } from 'node:test';
globalThis.__creatorSession = { access_token: 'TEST_ONLY_USER_TOKEN' };
const result = await build({ entryPoints: ['src/pages/dashboard/creator-api.ts'], bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'import.meta.env.VITE_WORKER_URL': '"https://launchly-worker.example"' },
  plugins: [{ name: 'test-auth', setup(build) {
    build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: 'test-auth', namespace: 'test-auth' }));
    build.onLoad({ filter: /.*/, namespace: 'test-auth' }, () => ({ contents: 'export const supabase = {auth: {getSession: async () => ({data: {session: globalThis.__creatorSession}})}};' }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
globalThis.window = { location: { origin: 'http://localhost:5173' } };
const signal = new AbortController().signal;
const fixture = { id: '123', username: 'fixture', region: 'GB', currency: 'GBP', followers: 1250, gmv: null, productCount: null, videoCount: null, itemsSold: null };
let requested;
function reply(data, status = 200) {
  globalThis.fetch = async (url, init) => { requested = { url, init }; return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); };
}
test('frontend calls only the Launchly Worker, attaches session, supports URL input and paging', async () => {
  reply({ success: true, data: { creators: [fixture], pagination: { page: 2, pageSize: 20, hasMore: true } } });
  const result = await api.searchCreators('https://www.tiktok.com/@Fixture', 'GB', 30, 2, 20, signal);
  assert.equal(requested.url.origin, 'https://launchly-worker.example');
  assert.equal(requested.url.pathname, '/api/launchly/creators/search'); assert.equal(requested.url.searchParams.get('q'), 'fixture');
  assert.equal(requested.url.searchParams.get('page'), '2'); assert.equal(requested.init.headers.Authorization, 'Bearer TEST_ONLY_USER_TOKEN');
  assert.equal(result.creators[0].analytics[30].metrics.revenue, undefined); assert.equal(result.pagination.hasMore, true);
});
test('not authenticated and subscription states are actionable', async () => {
  globalThis.__creatorSession = null;
  await assert.rejects(api.searchCreators('fixture', 'GB', 30, 1, 20, signal), { code: 'UNAUTHORIZED' });
  globalThis.__creatorSession = { access_token: 'TEST_ONLY_USER_TOKEN' };
  reply({ success: false, error: { code: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required.' } }, 403);
  assert.equal((await api.searchCreator('fixture', 'GB', 30, signal)).status, 'subscription_required');
});
test('malformed or mismatched market data is rejected; missing values remain absent', async () => {
  reply({ success: true, data: { creators: [{ ...fixture, region: 'US' }], pagination: {} } });
  await assert.rejects(api.searchCreators('fixture', 'GB', 30, 1, 20, signal), { code: 'UPSTREAM_ERROR' });
  assert.equal(api.number(undefined), '—'); assert.equal(api.number(null), '—'); assert.equal(api.number(0), '0');
  assert.equal(api.number(1250), '1.25K'); assert.equal(api.number(128400), '128.4K'); assert.equal(api.number(1500000), '1.5M');
  assert.equal(api.money(undefined), '—'); assert.equal(api.money(25, 'GBP'), '£25'); assert.equal(api.money(25, 'EUR'), '€25');
  assert.equal(api.safeUrl('javascript:alert(1)'), undefined);
});
test('detail loads its own endpoint and linked lists, never invents a time series', async () => {
  const paths = [];
  globalThis.fetch = async url => {
    paths.push(url.pathname);
    const data = url.pathname.endsWith('/products') ? { products: [{ id: '456', title: 'Fixture', commission: .1 }], pagination: {} } :
      url.pathname.endsWith('/videos') ? { videos: [{ id: '789', description: 'Fixture video', likes: 4 }], pagination: {} } : fixture;
    return new Response(JSON.stringify({ success: true, data }));
  };
  const c = await api.loadCreatorDetails(api.adaptCreator(fixture, 30), 30, signal);
  assert.equal(paths.length, 3); assert.ok(paths.includes('/api/launchly/creators/123/products'));
  assert.equal(c.analytics[30].products[0].commission, 10); assert.deepEqual(c.analytics[30].series, []);
  paths.length = 0; const longPeriod = await api.loadCreatorDetails(c, 90, signal);
  assert.equal(paths.length, 1); assert.equal(longPeriod.analytics[90].products.length, 0);
});
