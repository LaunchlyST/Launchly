// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock('../../../../subscription-backend/worker/node_modules/@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
import { handleMonitor } from '../../../../subscription-backend/worker/src/monitor/monitorRoutes';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test', MONITOR_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'), GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', MONITOR_GITHUB_REDIRECT_URI: 'http://127.0.0.1:5173/dashboard?section=monitor&github=connect' };
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
