// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock('../../../../subscription-backend/worker/node_modules/@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
import { handleMonitor, decryptSecret, encryptSecret } from '../../../../subscription-backend/worker/src/monitor/monitorRoutes';
import { providerError } from '../../../../subscription-backend/worker/src/monitor/providerErrors';

const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)));
const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test', MONITOR_ENCRYPTION_KEY: secret };
const req = (path: string, body?: unknown) => new Request(`https://test/api/monitor${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer user-session', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
let rows: any[];
let upsert: ReturnType<typeof vi.fn>;
let upstream: ReturnType<typeof vi.fn>;
let status: number;
let upstreamCode: string;
let projectRow: any;
beforeEach(() => {
  vi.clearAllMocks(); rows = []; status = 200; upstreamCode = '';
  projectRow = { id: 'proj-1', source: 'github', name: 'demo', repository: 'tester/demo', branch: 'main' };
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  upsert = vi.fn(async (row: any) => { rows = [...rows.filter(r => r.provider !== row.provider), row]; return { error: null }; });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'monitor_devices') {
      const chain: any = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, maybeSingle: async () => ({ data: { id: 'device-1', name: 'Test device' } }) };
      return chain;
    }
    if (table === 'monitor_projects') {
      const chain: any = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: projectRow, error: null }) };
      return chain;
    }
    return { select: () => ({ eq: vi.fn(async (column: string, id: string) => { expect(column).toBe('user_id'); expect(id).toBe('user-1'); return { data: rows, error: null }; }) }), upsert };
  });
  upstream = vi.fn(async (url: string, init?: RequestInit) => {
    if (status !== 200) return new Response(JSON.stringify({ error: { code: upstreamCode, message: 'Do not echo secret-sk-test' } }), { status, headers: { 'retry-after': '30' } });
    if (url.includes('/models')) return Response.json({ data: [{ id: url.includes('anthropic') ? 'claude-test-model' : 'gpt-test-model', created: 10 }] });
    return Response.json(url.includes('anthropic') ? { content: [{ type: 'text', text: 'Claude answer' }] } : { choices: [{ message: { content: 'OpenAI answer' } }] });
  });
});
afterEach(() => vi.unstubAllGlobals());

it.each(['openai', 'anthropic'])('saves encrypted %s key, verifies it and uses it only on the backend', async provider => {
  const key = 'sk-test-secret-1234';
  const save = await handleMonitor(req(`/providers/${provider}`, { apiKey: key }), env, upstream);
  const result: any = await save.json();
  expect(result.data).toMatchObject({ connected: true, state: 'connected', connectionType: 'api' });
  expect(JSON.stringify(result)).not.toContain(key);
  expect(rows[0].key_ciphertext).not.toContain(key);
  expect(await decryptSecret(secret, rows[0].key_ciphertext, rows[0].key_iv)).toBe(key);
  const verify: any = await (await handleMonitor(req(`/providers/${provider}/verify`, {}), env, upstream)).json();
  expect(verify.data.connected).toBe(true);
  const response = await handleMonitor(req('/chat', { model: { mode: 'latest', provider }, prompt: 'Explain this window', screenshot: 'data:image/png;base64,AAAA' }), env, upstream);
  const answer: any = await response.json();
  expect(answer.data).toMatchObject({ provider, connectionType: 'api', text: provider === 'openai' ? 'OpenAI answer' : 'Claude answer' });
  const [url, init] = upstream.mock.calls[upstream.mock.calls.length - 1];
  expect(url).toContain(provider === 'openai' ? 'api.openai.com' : 'api.anthropic.com');
  expect(JSON.parse(init.body).model).toBe(provider === 'openai' ? 'gpt-test-model' : 'claude-test-model');
  expect(JSON.stringify(init.headers)).toContain(key);
  expect(JSON.stringify(answer)).not.toContain(key);
});
it('does not store a key rejected by the provider', async () => {
  status = 401;
  const response = await handleMonitor(req('/providers/openai', { apiKey: 'sk-invalid-key-1234' }), env, upstream);
  expect(response.status).toBe(400); expect(upsert).not.toHaveBeenCalled();
});
it('does not trust the existence of a saved key after revocation', async () => {
  await handleMonitor(req('/providers/openai', { apiKey: 'sk-test-key-1234' }), env, upstream);
  status = 401;
  const result: any = await (await handleMonitor(req('/providers'), env, upstream)).json();
  expect(result.data.find((p: any) => p.provider === 'openai')).toMatchObject({ connected: false, state: 'error' });
});
it.each([[429, 'rate_limit_exceeded'], [429, 'insufficient_quota']])('returns structured limits for actual %s/%s responses', async (failureStatus, code) => {
  await handleMonitor(req('/providers/openai', { apiKey: 'sk-test-key-1234' }), env, upstream);
  status = failureStatus as number; upstreamCode = code as string;
  const response = await handleMonitor(req('/chat', { model: { mode: 'latest', provider: 'openai' }, prompt: 'Explain', screenshot: 'data:image/png;base64,AAAA' }), env, upstream);
  expect(response.status).toBe(429);
  const result: any = await response.json();
  expect(result.error).toMatchObject({ code: 'PROVIDER_LIMITED', provider: 'openai', connectionType: 'api', retryAfter: '30' });
  expect(JSON.stringify(result)).not.toContain('secret-sk-test');
  expect(JSON.stringify(result)).not.toContain('subscription usage');
});
it('limits on inference, not only key verification, propagate unchanged', async () => {
  await handleMonitor(req('/providers/anthropic', { apiKey: 'sk-test-key-1234' }), env, upstream);
  const original = upstream.getMockImplementation()!;
  upstream.mockImplementation(async (url: string, init?: RequestInit) => url.includes('/messages')
    ? new Response(JSON.stringify({ error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }), { status: 400 })
    : original(url, init));
  const result: any = await (await handleMonitor(req('/chat', { model: { mode: 'latest', provider: 'anthropic' }, prompt: 'Explain', screenshot: 'data:image/png;base64,AAAA' }), env, upstream)).json();
  expect(result.error.code).toBe('PROVIDER_LIMITED');
});
it('refuses a missing selected connection and never silently switches provider', async () => {
  await handleMonitor(req('/providers/openai', { apiKey: 'sk-test-key-1234' }), env, upstream);
  upstream.mockClear();
  const response = await handleMonitor(req('/chat', { model: { mode: 'latest', provider: 'anthropic' }, prompt: 'Explain', screenshot: 'data:image/png;base64,AAAA' }), env, upstream);
  expect(response.status).toBe(409); expect(upstream).not.toHaveBeenCalled();
});
it('forwards the selected backend connection to the existing device agent without requiring a project', async () => {
  await handleMonitor(req('/providers/anthropic', { apiKey: 'sk-test-key-1234' }), env, upstream);
  const deviceFetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ taskId: 'task' }));
  const deviceEnv = { ...env, DEVICE_SESSION: { get: () => ({ fetch: deviceFetch }), idFromName: (id: string) => id } } as any;
  const response = await handleMonitor(req('/agent/tasks', { model: { mode: 'latest', provider: 'anthropic' }, prompt: 'Click Settings', screenshot: 'data:image/png;base64,AAAA' }), deviceEnv, upstream);
  expect(response.status).toBe(200);
  expect(JSON.parse(deviceFetch.mock.calls[0][1].body as string)).toMatchObject({ provider: 'anthropic', model: 'claude-test-model', apiKey: 'sk-test-key-1234' });
  expect(await response.text()).not.toContain('sk-test-key');
});
it('requires a user session for provider verification and inference', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  expect((await handleMonitor(req('/chat', {}), env, upstream)).status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
});
it('distinguishes genuine subscription limits from API limits and server failures', async () => {
  const limited = await providerError(new Response('{}', { status: 429 }), 'openai', 'subscription');
  expect(limited.failure.message).toBe('Your subscription usage is currently limited. Switch to API to continue.');
  const serverError = await providerError(new Response('{}', { status: 500 }), 'openai');
  expect(serverError.failure.code).toBe('PROVIDER_ERROR');
});
async function seedSubscriptionRow(token: string) {
  const access = await encryptSecret(secret, token);
  rows.push({ provider: 'anthropic', connection_type: 'subscription', access_token_ciphertext: access.ciphertext, access_token_iv: access.iv, refresh_token_ciphertext: null, refresh_token_iv: null, key_ciphertext: null, key_iv: null, key_last4: null });
}
function keyedUpstream(validTokens: string[]) {
  const base = upstream.getMockImplementation()!;
  return vi.fn(async (url: string, init?: any) => {
    const auth = String(init?.headers?.['x-api-key'] ?? init?.headers?.Authorization ?? '');
    if (url.includes('anthropic') && (url.includes('/models') || url.includes('/messages')) && !validTokens.some(t => auth.includes(t))) {
      return new Response(JSON.stringify({ error: { type: 'authentication_error', message: 'invalid token' } }), { status: 401 });
    }
    return base(url, init);
  });
}
it('prefers a valid subscription connection over the API key', async () => {
  await handleMonitor(req('/providers/anthropic', { apiKey: 'sk-test-key-1234' }), env, upstream);
  await seedSubscriptionRow('sub-good-token');
  const subUpstream = keyedUpstream(['sub-good-token']);
  const response = await handleMonitor(req('/chat', { model: { mode: 'latest', provider: 'anthropic' }, prompt: 'Explain', screenshot: 'data:image/png;base64,AAAA' }), env, subUpstream);
  const answer: any = await response.json();
  expect(answer.data).toMatchObject({ connectionType: 'subscription', text: 'Claude answer' });
  expect(JSON.stringify(subUpstream.mock.calls)).toContain('sub-good-token');
  expect(JSON.stringify(answer)).not.toContain('sub-good-token');
});
it('falls back to the API key when the subscription token is rejected', async () => {
  await handleMonitor(req('/providers/anthropic', { apiKey: 'sk-test-key-1234' }), env, upstream);
  await seedSubscriptionRow('sub-revoked-token');
  const subUpstream = keyedUpstream(['sk-test-key-1234']);
  const response = await handleMonitor(req('/chat', { model: { mode: 'latest', provider: 'anthropic' }, prompt: 'Explain', screenshot: 'data:image/png;base64,AAAA' }), env, subUpstream);
  const answer: any = await response.json();
  expect(answer.data).toMatchObject({ connectionType: 'api', text: 'Claude answer' });
});
it('forwards the selected project and monitor index to the device agent', async () => {
  await handleMonitor(req('/providers/anthropic', { apiKey: 'sk-test-key-1234' }), env, upstream);
  const deviceFetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ taskId: 'task' }));
  const deviceEnv = { ...env, DEVICE_SESSION: { get: () => ({ fetch: deviceFetch }), idFromName: (id: string) => id } } as any;
  const response = await handleMonitor(req('/agent/tasks', { model: { mode: 'latest', provider: 'anthropic' }, prompt: 'Fix it', projectId: 'proj-1', monitorIndex: 2 }), deviceEnv, upstream);
  expect(response.status).toBe(200);
  expect(JSON.parse(deviceFetch.mock.calls[0][1].body as string)).toMatchObject({
    project: { id: 'proj-1', repository: 'tester/demo', branch: 'main' },
    monitorIndex: 2,
  });
});
const cliStatus = (claude: object, codex: object) => ({ claude, codex });
function localDeviceEnv(cli: object, status = 200) {
  const deviceFetch = vi.fn(async (url: string, _init: RequestInit) => {
    if (String(url).endsWith('/subscription')) {
      return status === 200 ? Response.json(cli) : new Response('{}', { status });
    }
    return Response.json({ taskId: 'task' });
  });
  const deviceEnv = { ...env, DEVICE_SESSION: { get: () => ({ fetch: deviceFetch }), idFromName: (id: string) => id } } as any;
  return { deviceFetch, deviceEnv };
}
it('local mode needs the device relay, a paired computer, and a logged-in CLI', async () => {
  const noRelay = await handleMonitor(req('/agent/tasks', { model: { mode: 'local', provider: 'anthropic' }, prompt: 'Fix it' }), env, upstream);
  expect(noRelay.status).toBe(501);
  const { deviceEnv } = localDeviceEnv(cliStatus({ installed: false, authenticated: false }, { installed: false, authenticated: false }), 409);
  const offline = await handleMonitor(req('/agent/tasks', { model: { mode: 'local', provider: 'anthropic' }, prompt: 'Fix it' }), deviceEnv, upstream);
  expect(offline.status).toBe(409);
  const { deviceEnv: noCli } = localDeviceEnv(cliStatus({ installed: false, authenticated: false }, { installed: false, authenticated: false }));
  const missing = await handleMonitor(req('/agent/tasks', { model: { mode: 'local', provider: 'anthropic' }, prompt: 'Fix it' }), noCli, upstream);
  expect(missing.status).toBe(409);
  expect(((await missing.json()) as any).error.message).toContain('Install Claude Code');
  const { deviceEnv: loggedOut } = localDeviceEnv(cliStatus({ installed: true, authenticated: false }, { installed: false, authenticated: false }));
  const unauthed = await handleMonitor(req('/agent/tasks', { model: { mode: 'local', provider: 'anthropic' }, prompt: 'Fix it' }), loggedOut, upstream);
  expect(unauthed.status).toBe(409);
  expect(((await unauthed.json()) as any).error.message).toContain('claude auth login');
});
it('local mode starts a device task with no server-side key', async () => {
  const { deviceFetch, deviceEnv } = localDeviceEnv(cliStatus({ installed: true, authenticated: true }, { installed: true, authenticated: true }));
  const response = await handleMonitor(req('/agent/tasks', { model: { mode: 'local', provider: 'openai' }, prompt: 'Fix it', projectId: 'proj-1' }), deviceEnv, upstream);
  expect(response.status).toBe(200);
  const sent = JSON.parse(deviceFetch.mock.calls[deviceFetch.mock.calls.length - 1][1].body as string);
  expect(sent).toMatchObject({ provider: 'openai', connectionType: 'local', apiKey: '' });
  expect(sent.project).toMatchObject({ id: 'proj-1', repository: 'tester/demo' });
  expect(await response.text()).not.toContain('sk-test-key');
});
it('local mode is rejected for plain chat', async () => {
  const response = await handleMonitor(req('/chat', { model: { mode: 'local', provider: 'anthropic' }, prompt: 'Hi', screenshot: 'data:image/png;base64,AAAA' }), env, upstream);
  expect(response.status).toBe(400);
});
it('relays the latest agent frame and stream control to the paired device', async () => {
  const deviceFetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/frames/latest')) {
      return Response.json({ waiting: false, received: 7, frame: { image: 'data:image/png;base64,AAAA', ts: 1, seq: 7, monitor: 0, width: 960, bytes: 3000 } });
    }
    return Response.json({ streaming: true });
  });
  const deviceEnv = { ...env, DEVICE_SESSION: { get: () => ({ fetch: deviceFetch }), idFromName: (id: string) => id } } as any;
  const frame = await handleMonitor(req('/device/frame'), deviceEnv, upstream);
  expect(frame.status).toBe(200);
  const framed: any = await frame.json();
  expect(framed.data.frame).toMatchObject({ seq: 7, bytes: 3000 });
  const stream = await handleMonitor(req('/device/stream', { on: true, fps: 0.5, width: 960, monitor: 0 }), deviceEnv, upstream);
  expect(stream.status).toBe(200);
  const streamCall = deviceFetch.mock.calls.find(([u]) => String(u).endsWith('/stream'))!;
  expect(JSON.parse(streamCall[1]!.body as string)).toMatchObject({ on: true, fps: 0.5 });
});
it('rejects a projectId that does not belong to the user', async () => {
  await handleMonitor(req('/providers/anthropic', { apiKey: 'sk-test-key-1234' }), env, upstream);
  projectRow = null;
  const deviceFetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ taskId: 'task' }));
  const deviceEnv = { ...env, DEVICE_SESSION: { get: () => ({ fetch: deviceFetch }), idFromName: (id: string) => id } } as any;
  const response = await handleMonitor(req('/agent/tasks', { model: { mode: 'latest', provider: 'anthropic' }, prompt: 'Fix it', projectId: 'other-users-project' }), deviceEnv, upstream);
  expect(response.status).toBe(404);
  expect(deviceFetch).not.toHaveBeenCalled();
});
