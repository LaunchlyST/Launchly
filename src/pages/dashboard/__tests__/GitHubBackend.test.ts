// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock('../../../../subscription-backend/worker/node_modules/@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
import { handleMonitor, encryptSecret, decryptSecret } from '../../../../subscription-backend/worker/src/monitor/monitorRoutes';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test', MONITOR_ENCRYPTION_KEY: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=', GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', MONITOR_GITHUB_REDIRECT_URI: 'http://127.0.0.1:5173/dashboard?section=monitor&github=connect' };
const request = (path: string, body: object) => new Request(`http://localhost/api/monitor/github/${path}`, { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } }); });

it('creates PKCE and short-lived state bound to the signed-in user', async () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ insert });
  const result = await handleMonitor(request('authorize', {}), env);
  const body = await result.json() as any;
  const url = new URL(body.data.authorizeUrl);
  expect(url.origin).toBe('https://github.com');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('redirect_uri')).toBe(env.MONITOR_GITHUB_REDIRECT_URI);
  expect(insert.mock.calls[0][0].user_id).toBe('user-1');
  expect(insert.mock.calls[0][0].state).toBe(url.searchParams.get('state'));
  expect(JSON.stringify(body)).not.toContain(insert.mock.calls[0][0].verifier);
});
it('rejects consumed, expired or other-user state before exchanging any code', async () => {
  const chain: any = { delete: vi.fn(), eq: vi.fn(), gt: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
  for (const key of ['delete', 'eq', 'gt', 'select']) chain[key].mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
  const fetcher = vi.fn();
  const result = await handleMonitor(request('complete', { code: 'code', state: 'old-state' }), env, fetcher);
  expect(result.status).toBe(400);
  expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  expect(chain.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects unauthenticated authorization without writing state', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  const result = await handleMonitor(request('authorize', {}), env);
  expect(result.status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});

function accountsMock(account: any, onUpdate: (patch: any) => void) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: account, error: null }));
  chain.update = vi.fn((patch: any) => { onUpdate(patch); return { eq: vi.fn(async () => ({ error: null })) }; });
  chain.delete = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  mocks.from.mockImplementation((table: string) => {
    if (table === 'monitor_github_accounts' || table === 'monitor_github_oauth') return chain;
    throw new Error(`unexpected table ${table}`);
  });
  return chain;
}
const getReq = (path: string) => new Request(`http://localhost/api/monitor/github/${path}`, { method: 'GET', headers: { Authorization: 'Bearer test' } });

it('renews an expiring GitHub App token via the rotating refresh token', async () => {
  const secret = env.MONITOR_ENCRYPTION_KEY;
  const oldAccess = await encryptSecret(secret, 'old-access');
  const oldRefresh = await encryptSecret(secret, 'old-refresh');
  let saved: any = null;
  accountsMock({
    token_ciphertext: oldAccess.ciphertext, token_iv: oldAccess.iv, login: 'tester',
    refresh_token_ciphertext: oldRefresh.ciphertext, refresh_token_iv: oldRefresh.iv,
    token_expires_at: new Date(Date.now() - 1000).toISOString(),
  }, (patch) => { saved = patch; });
  const fetcher = vi.fn(async (url: string) => {
    if (String(url).includes('/login/oauth/access_token')) {
      return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 28800 });
    }
    return Response.json([{ id: 1, full_name: 'tester/demo', private: false, default_branch: 'main', updated_at: null }]);
  });
  const result = await handleMonitor(getReq('repos'), env, fetcher);
  expect(result.status).toBe(200);
  const body: any = await result.json();
  expect(body.data).toMatchObject([{ fullName: 'tester/demo' }]);
  // Rotation persisted: new access token stored, expiry extended, refresh rotated.
  expect(await decryptSecret(secret, saved.token_ciphertext, saved.token_iv)).toBe('new-access');
  expect(await decryptSecret(secret, saved.refresh_token_ciphertext, saved.refresh_token_iv)).toBe('new-refresh');
  expect(Date.parse(saved.token_expires_at)).toBeGreaterThan(Date.now());
  // The refreshed token — never the old one — authorizes the API call.
  const apiCall = fetcher.mock.calls.find(([u]) => String(u).includes('api.github.com')) as any[];
  expect(apiCall).toBeTruthy();
  expect(String(apiCall[1].headers.Authorization)).toBe('Bearer new-access');
});

it('expired token without refresh requires reconnect instead of failing silently', async () => {
  const oldAccess = await encryptSecret(env.MONITOR_ENCRYPTION_KEY, 'old-access');
  accountsMock({ token_ciphertext: oldAccess.ciphertext, token_iv: oldAccess.iv, login: 'tester', token_expires_at: new Date(Date.now() - 1000).toISOString() }, () => {});
  const fetcher = vi.fn();
  const result = await handleMonitor(getReq('repos'), env, fetcher);
  expect(result.status).toBe(401);
  const body: any = await result.json();
  expect(body.error.message).toMatch(/expired.*reconnect/i);
  expect(fetcher).not.toHaveBeenCalled();
});

it('disconnect removes the stored GitHub connection', async () => {
  const chain = accountsMock({ token_ciphertext: 'x', token_iv: 'y', login: 'tester' }, () => {});
  const delReq = new Request('http://localhost/api/monitor/github/disconnect', { method: 'DELETE', headers: { Authorization: 'Bearer test' } });
  const result = await handleMonitor(delReq, env, vi.fn());
  expect(result.status).toBe(200);
  expect(chain.delete).toHaveBeenCalled();
});
