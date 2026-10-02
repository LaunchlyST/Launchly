import { createClient } from '@supabase/supabase-js';

/**
 * Monitor backend (projects + AI providers).
 *
 * Provider API keys: sent once over HTTPS, encrypted with AES-GCM using
 * MONITOR_ENCRYPTION_KEY, stored in Supabase, and never returned — callers
 * only ever get { provider, connected, keyLast4 }.
 *
 * GitHub, git-URL import, Monitor Bridge and the project agent are declared
 * here but answer NOT_CONFIGURED until their infrastructure exists, so the
 * UI never shows a fake success.
 */

export interface MonitorEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** base64 of 32 random bytes. Required to store provider keys. */
  MONITOR_ENCRYPTION_KEY?: string;
  /** Optional JSON override, e.g. {"anthropic":"claude-opus-5-5","openai":"…","xai":"…"} */
  MONITOR_LATEST_MODELS?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** One Durable Object per paired computer running the local agent (see deviceSession.ts). */
  DEVICE_SESSION?: DurableObjectNamespace;
}

type ProviderId = 'anthropic' | 'openai' | 'xai';
const PROVIDER_IDS: ProviderId[] = ['anthropic', 'openai', 'xai'];

/**
 * Which model "Latest" means for each provider. Server-maintained so it can
 * move forward when a provider ships a newer recommended model — users on
 * "Latest" follow automatically; users who pinned an exact model don't.
 * null = pick the newest model the provider lists for that key.
 */
export const DEFAULT_LATEST: Record<ProviderId, string | null> = {
  anthropic: 'claude-opus-5-5',
  openai: null,
  xai: null,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: CORS });
const fail = (code: string, message: string, status: number) =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), { status, headers: CORS });

export const isMonitorRoute = (p: string) => p.startsWith('/api/monitor/');

// ------------------------------------------------------------------ crypto

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function importKey(secret: string): Promise<CryptoKey> {
  const raw = unb64(secret);
  if (raw.length !== 32) throw new Error('MONITOR_ENCRYPTION_KEY must be 32 bytes (base64).');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(secret: string, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(secret), new TextEncoder().encode(plaintext));
  return { ciphertext: b64(new Uint8Array(ct)), iv: b64(iv) };
}

export async function decryptSecret(secret: string, ciphertext: string, iv: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await importKey(secret), unb64(ciphertext));
  return new TextDecoder().decode(pt);
}

// --------------------------------------------------------------- providers

/** Validate a key by listing models — read-only, costs nothing. */
export async function listProviderModels(provider: ProviderId, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<{ id: string; name: string; created: number }[] | null> {
  const req =
    provider === 'anthropic'
      ? fetchImpl('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } })
      : fetchImpl(provider === 'openai' ? 'https://api.openai.com/v1/models' : 'https://api.x.ai/v1/models', { headers: { Authorization: `Bearer ${apiKey}` } });
  const res = await req;
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Provider returned ${res.status}`);
  const body: any = await res.json();
  return (body.data ?? []).map((m: any) => ({
    id: String(m.id),
    name: String(m.display_name ?? m.id),
    created: typeof m.created === 'number' ? m.created : m.created_at ? Date.parse(m.created_at) / 1000 : 0,
  }));
}

/** Coding-capable chat models only (drop embeddings, audio, image, moderation…). */
export function isCodingModel(provider: ProviderId, id: string): boolean {
  if (/embed|whisper|tts|audio|image|dall|moderation|realtime|transcribe|search|vision-preview/i.test(id)) return false;
  if (provider === 'anthropic') return /^claude/i.test(id);
  if (provider === 'openai') return /^(gpt|o\d|codex)/i.test(id);
  return /^grok/i.test(id);
}

function latestMap(env: MonitorEnv): Record<ProviderId, string | null> {
  try {
    return { ...DEFAULT_LATEST, ...(env.MONITOR_LATEST_MODELS ? JSON.parse(env.MONITOR_LATEST_MODELS) : {}) };
  } catch {
    return DEFAULT_LATEST;
  }
}

// -------------------------------------------------------------- device agent

/** Hashes a device token for storage — the plaintext token is only ever shown once, at pairing time. */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return b64(new Uint8Array(digest));
}

function randomToken(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, '').slice(0, 40);
}

// ------------------------------------------------------------------ router

export async function handleMonitor(request: Request, env: MonitorEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/monitor/, '');

  const hasDb = !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const db = hasDb ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) : null;

  // The local agent authenticates with its own long-lived device token, not a
  // Supabase user session — handle it before the user-auth check below.
  if (path === '/device/connect') {
    if (!db || !env.DEVICE_SESSION) return fail('NOT_CONFIGURED', 'The device relay isn’t set up on the server yet.', 501);
    const deviceToken = url.searchParams.get('token') || '';
    if (!deviceToken) return fail('UNAUTHENTICATED', 'Missing device token.', 401);
    const { data: device } = await db.from('monitor_devices').select('id, token_hash').eq('token_hash', await hashToken(deviceToken)).maybeSingle();
    if (!device) return fail('UNAUTHENTICATED', 'This computer isn’t paired. Reconnect it from Monitor.', 401);
    await db.from('monitor_devices').update({ status: 'online', last_seen_at: new Date().toISOString() }).eq('id', device.id);
    const stub = env.DEVICE_SESSION.get(env.DEVICE_SESSION.idFromName(device.id));
    return stub.fetch(new Request(`https://device-session/connect`, request));
  }

  const token = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const userId = token && db ? (await db.auth.getUser(token)).data?.user?.id ?? null : null;
  if (!userId) return fail('UNAUTHENTICATED', 'Sign in required.', 401);

  const keysReady = !!(db && env.MONITOR_ENCRYPTION_KEY);

  const loadKeys = async () => {
    const { data, error } = await db!.from('monitor_provider_keys').select('provider, key_ciphertext, key_iv, key_last4').eq('user_id', userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as { provider: ProviderId; key_ciphertext: string; key_iv: string; key_last4: string }[];
  };

  /** Every authenticated device/task route below needs this user's paired computer. */
  const getDevice = async () => {
    if (!db) return null;
    const { data } = await db.from('monitor_devices').select('id, name, status, last_seen_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data as { id: string; name: string; status: string; last_seen_at: string | null } | null;
  };

  if (path === '/device/pair' && request.method === 'POST') {
    if (!db) return fail('NOT_CONFIGURED', 'The device relay isn’t set up on the server yet.', 501);
    const body = (await request.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'My computer';
    const plainToken = randomToken();
    const { data, error } = await db.from('monitor_devices').insert({ user_id: userId, name, token_hash: await hashToken(plainToken), status: 'offline' }).select('id').single();
    if (error || !data) return fail('SERVER_ERROR', 'Couldn’t pair this computer.', 500);
    // The token is returned exactly once — it is not recoverable afterwards, only re-issuable via a new pairing.
    return ok({ deviceId: data.id, name, token: plainToken });
  }

  if (path === '/device/status' && request.method === 'GET') {
    const device = await getDevice();
    if (!device) return ok({ paired: false, online: false, name: null });
    let online = device.status === 'online';
    if (env.DEVICE_SESSION) {
      try {
        const stub = env.DEVICE_SESSION.get(env.DEVICE_SESSION.idFromName(device.id));
        const r = await stub.fetch('https://device-session/status');
        online = ((await r.json()) as { online: boolean }).online;
      } catch {
        online = false;
      }
    }
    return ok({ paired: true, online, name: device.name });
  }

  if (path === '/agent/tasks' && request.method === 'POST') {
    if (!env.DEVICE_SESSION) return fail('NOT_CONFIGURED', 'The project agent isn’t available on the server yet.', 501);
    const body = (await request.json().catch(() => ({}))) as { prompt?: unknown; model?: unknown; screenshot?: unknown; permissions?: unknown; maxActions?: unknown };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return fail('INVALID_REQUEST', 'A prompt is required.', 400);
    if (prompt.length > 4000) return fail('INVALID_REQUEST', 'Prompt is too long (max 4000 characters).', 400);
    const device = await getDevice();
    if (!device) return fail('UNAVAILABLE', 'Connect a computer first.', 409);
    if (!keysReady) return fail('NOT_CONFIGURED', 'AI keys aren’t set up on the server yet.', 501);
    const rows = await loadKeys();
    const sel = body.model as { mode?: string; provider?: ProviderId; modelId?: string } | string | undefined;
    let provider: ProviderId = 'anthropic';
    if (typeof sel === 'string' && sel.includes(':')) provider = sel.split(':')[0] as ProviderId;
    else if (sel && typeof sel === 'object' && sel.provider) provider = sel.provider;
    else {
      // auto: prefer the first connected provider that supports vision + tools
      const connected = rows.map((r) => r.provider);
      provider = (['anthropic', 'openai'].find((p) => connected.includes(p as ProviderId)) ?? connected[0] ?? 'anthropic') as ProviderId;
    }
    if (!['anthropic', 'openai'].includes(provider)) return fail('NOT_CONFIGURED', 'Screen control needs an Anthropic or OpenAI model.', 501);
    const key = rows.find((r) => r.provider === provider);
    if (!key) return fail('UNAVAILABLE', `Connect ${provider} in AI settings first.`, 409);
    const apiKey = await decryptSecret(env.MONITOR_ENCRYPTION_KEY!, key.key_ciphertext, key.key_iv);
    const map = latestMap(env);
    const model = typeof sel === 'string' && sel.includes(':') ? sel.split(':')[1]
      : sel && typeof sel === 'object' && sel.mode === 'exact' ? sel.modelId!
      : sel && typeof sel === 'object' && sel.mode === 'latest' ? (map[provider] || '') || (provider === 'anthropic' ? 'claude-opus-4-6' : 'gpt-4o')
      : (map[provider] || '') || (provider === 'anthropic' ? 'claude-opus-4-6' : 'gpt-4o');
    const screenshot = typeof body.screenshot === 'string' && body.screenshot.length < 8_000_000 ? body.screenshot : null;
    const permissions = body.permissions && typeof body.permissions === 'object' ? body.permissions : {};
    const maxActions = typeof body.maxActions === 'number' ? Math.min(Math.max(Math.floor(body.maxActions), 1), 60) : 30;
    const taskId = crypto.randomUUID();
    const stub = env.DEVICE_SESSION.get(env.DEVICE_SESSION.idFromName(device.id));
    const r = await stub.fetch('https://device-session/tasks', { method: 'POST', body: JSON.stringify({ taskId, prompt, apiKey, model, provider, screenshot, permissions, maxActions }) });
    if (r.status === 409) return fail('UNAVAILABLE', 'Computer disconnected. Start the local agent and try again.', 409);
    if (!r.ok) return fail('SERVER_ERROR', 'Couldn’t start the task.', 500);
    return ok({ taskId });
  }

  const agentStopMatch = path.match(/^\/agent\/tasks\/([^/]+)\/stop$/);
  if (agentStopMatch && request.method === 'POST') {
    if (!env.DEVICE_SESSION) return fail('NOT_CONFIGURED', 'The project agent isn’t available on the server yet.', 501);
    const device = await getDevice();
    if (!device) return fail('UNAVAILABLE', 'Connect a computer first.', 409);
    const stub = env.DEVICE_SESSION.get(env.DEVICE_SESSION.idFromName(device.id));
    const r = await stub.fetch(`https://device-session/tasks/${encodeURIComponent(agentStopMatch[1])}/stop`, { method: 'POST' });
    if (!r.ok) return fail('NOT_FOUND', 'Task not found.', 404);
    return ok({ stopped: true });
  }

  const agentApproveMatch = path.match(/^\/agent\/tasks\/([^/]+)\/approve$/);
  if (agentApproveMatch && request.method === 'POST') {
    if (!env.DEVICE_SESSION) return fail('NOT_CONFIGURED', 'The project agent isn’t available on the server yet.', 501);
    const device = await getDevice();
    if (!device) return fail('UNAVAILABLE', 'Connect a computer first.', 409);
    const stub = env.DEVICE_SESSION.get(env.DEVICE_SESSION.idFromName(device.id));
    const r = await stub.fetch(`https://device-session/tasks/${encodeURIComponent(agentApproveMatch[1])}/approve`, { method: 'POST' });
    if (!r.ok) return fail('NOT_FOUND', 'Nothing to approve.', 404);
    return ok({ approved: true });
  }

  const agentTaskMatch = path.match(/^\/agent\/tasks\/([^/]+)$/);
  if (agentTaskMatch && request.method === 'GET') {
    if (!env.DEVICE_SESSION) return fail('NOT_CONFIGURED', 'The project agent isn’t available on the server yet.', 501);
    const device = await getDevice();
    if (!device) return fail('UNAVAILABLE', 'Connect a computer first.', 409);
    const stub = env.DEVICE_SESSION.get(env.DEVICE_SESSION.idFromName(device.id));
    const r = await stub.fetch(`https://device-session/tasks/${encodeURIComponent(agentTaskMatch[1])}`);
    if (!r.ok) return fail('NOT_FOUND', 'Task not found.', 404);
    return ok(await r.json());
  }

  if (path === '/status' && request.method === 'GET') {
    return ok({
      online: true,
      capabilities: {
        github: false, // OAuth and repository workspace routes are not implemented yet.
        gitUrl: false,
        localBridge: false,
        agent: !!env.DEVICE_SESSION,
        providerKeys: keysReady,
        screenControl: !!env.DEVICE_SESSION,
      },
    });
  }

  if (path === '/providers' && request.method === 'GET') {
    if (!keysReady) return ok(PROVIDER_IDS.map((provider) => ({ provider, connected: false, keyLast4: null })));
    const rows = await loadKeys();
    return ok(PROVIDER_IDS.map((provider) => {
      const r = rows.find((x) => x.provider === provider);
      return { provider, connected: !!r, keyLast4: r?.key_last4 ?? null };
    }));
  }

  const provMatch = path.match(/^\/providers\/(anthropic|openai|xai)(\/test)?$/);
  if (provMatch) {
    const provider = provMatch[1] as ProviderId;
    if (request.method === 'DELETE' && !provMatch[2]) {
      if (!keysReady) return fail('NOT_CONFIGURED', 'Saving AI keys isn’t set up on the server yet.', 501);
      await db!.from('monitor_provider_keys').delete().eq('user_id', userId).eq('provider', provider);
      return ok({ provider, connected: false, keyLast4: null });
    }
    if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
    const body = (await request.json().catch(() => null)) as { apiKey?: unknown } | null;
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    if (apiKey.length < 10 || apiKey.length > 400 || /\s/.test(apiKey)) return fail('INVALID_KEY', 'That doesn’t look like an API key.', 400);

    let models: Awaited<ReturnType<typeof listProviderModels>>;
    try {
      models = await listProviderModels(provider, apiKey, fetchImpl);
    } catch {
      return fail('PROVIDER_UNAVAILABLE', 'Couldn’t reach the provider to check the key. Try again.', 502);
    }
    if (provMatch[2]) return ok({ valid: !!models });
    if (!models) return fail('INVALID_KEY', 'The provider rejected this key.', 400);
    if (!keysReady) return fail('NOT_CONFIGURED', 'Saving AI keys isn’t set up on the server yet.', 501);

    const { ciphertext, iv } = await encryptSecret(env.MONITOR_ENCRYPTION_KEY!, apiKey);
    const keyLast4 = apiKey.slice(-4);
    const { error } = await db!
      .from('monitor_provider_keys')
      .upsert({ user_id: userId, provider, key_ciphertext: ciphertext, key_iv: iv, key_last4: keyLast4, updated_at: new Date().toISOString() }, { onConflict: 'user_id,provider' });
    if (error) return fail('SERVER_ERROR', 'Couldn’t save the key.', 500);
    return ok({ provider, connected: true, keyLast4 });
  }

  if (path === '/models' && request.method === 'GET') {
    const latest = latestMap(env);
    if (!keysReady) return ok({ models: [], latest });
    const rows = await loadKeys();
    const models: unknown[] = [];
    const resolved: Record<string, string | null> = { ...latest };
    for (const r of rows) {
      try {
        const key = await decryptSecret(env.MONITOR_ENCRYPTION_KEY!, r.key_ciphertext, r.key_iv);
        const list = ((await listProviderModels(r.provider, key, fetchImpl)) ?? []).filter((m) => isCodingModel(r.provider, m.id)).sort((a, b) => b.created - a.created);
        const newest = list[0]?.id ?? null;
        if (!resolved[r.provider] || !list.some((m) => m.id === resolved[r.provider])) resolved[r.provider] = newest;
        for (const m of list)
          models.push({ provider: r.provider, modelId: m.id, displayName: m.name, family: r.provider, capabilities: ['coding', 'chat'], recommended: m.id === resolved[r.provider], available: true });
      } catch {
        /* one provider failing must not hide the others */
      }
    }
    return ok({ models, latest: resolved });
  }

  if (path === '/projects' && request.method === 'GET') {
    const { data, error } = await db!.from('monitor_projects')
      .select('id, source, name, repository, branch, status')
      .eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return fail('NOT_CONFIGURED', 'Saved projects are not available. The project service needs to be configured.', 501);
    return ok(data ?? []);
  }

  // Declared but not built yet: never pretend.
  if (/^\/(github|projects|agent)(\/|$)/.test(path)) {
    return fail('NOT_CONFIGURED', path.startsWith('/github') ? 'GitHub connection isn’t set up on the server yet.' : 'The project agent isn’t available on the server yet.', 501);
  }
  return fail('NOT_FOUND', 'Not found.', 404);
}
