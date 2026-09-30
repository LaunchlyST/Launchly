import { createClient } from '@supabase/supabase-js';

/**
 * Monitor backend (projects + AI providers).
 *
 * Provider API keys: sent once over HTTPS, encrypted with AES-GCM using
 * MONITOR_ENCRYPTION_KEY, stored in Supabase, and never returned — callers
 * only ever get { provider, connected, keyLast4 }.
 *
 * GitHub OAuth stores encrypted tokens and validates repository selection.
 * Workspace execution, git-URL import and Monitor Bridge remain unavailable.
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
  MONITOR_GITHUB_REDIRECT_URI?: string;
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

// ------------------------------------------------------------------ router

export async function handleMonitor(request: Request, env: MonitorEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/monitor/, '');

  const hasDb = !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const db = hasDb ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) : null;
  const token = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const userId = token && db ? (await db.auth.getUser(token)).data?.user?.id ?? null : null;
  if (!userId) return fail('UNAUTHENTICATED', 'Sign in required.', 401);

  const keysReady = !!(db && env.MONITOR_ENCRYPTION_KEY);

  if (path === '/status' && request.method === 'GET') {
    return ok({
      online: true,
      capabilities: {
        github: !!(keysReady && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.MONITOR_GITHUB_REDIRECT_URI),
        gitUrl: false,
        localBridge: false,
        agent: false,
        providerKeys: keysReady,
      },
    });
  }

  if (path.startsWith('/github/') || (path === '/projects' && request.method === 'POST')) {
    if (!keysReady || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.MONITOR_GITHUB_REDIRECT_URI)
      return fail('NOT_CONFIGURED', 'GitHub connection needs an OAuth app and callback URL configured on the server.', 501);
    const github = async (accessToken: string, endpoint: string) => {
      const response = await fetchImpl(`https://api.github.com${endpoint}`, { headers: {
        Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Launchly-Monitor',
      } });
      if (!response.ok) throw new Error(response.status === 401 ? 'Reconnect your GitHub account.' : 'GitHub could not load this repository. Check your access and try again.');
      return response.json() as Promise<any>;
    };
    try {
      if (path === '/github/authorize' && request.method === 'POST') {
        const state = crypto.randomUUID();
        const verifier = crypto.randomUUID() + crypto.randomUUID();
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        const challenge = b64(new Uint8Array(digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const { error } = await db!.from('monitor_github_oauth').insert({ state, user_id: userId, verifier, expires_at: new Date(Date.now() + 600000).toISOString() });
        if (error) return fail('NOT_CONFIGURED', 'GitHub storage needs to be configured.', 501);
        const authorize = new URL('https://github.com/login/oauth/authorize');
        authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: env.MONITOR_GITHUB_REDIRECT_URI, scope: 'repo', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
        return ok({ authorizeUrl: authorize.href });
      }
      if (path === '/github/complete' && request.method === 'POST') {
        const body = await request.json() as { code?: string; state?: string };
        if (typeof body.code !== 'string' || body.code.length > 512 || typeof body.state !== 'string') return fail('INVALID_CALLBACK', 'Invalid GitHub callback.', 400);
        const { data: pending, error } = await db!.from('monitor_github_oauth').delete().eq('state', body.state).eq('user_id', userId).gt('expires_at', new Date().toISOString()).select('verifier').maybeSingle();
        if (error || !pending) return fail('INVALID_STATE', 'This GitHub connection expired or was already used. Please connect again.', 400);
        const exchange = await fetchImpl('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: body.code, redirect_uri: env.MONITOR_GITHUB_REDIRECT_URI, code_verifier: pending.verifier }) });
        const credentials = await exchange.json() as { access_token?: string };
        if (!exchange.ok || !credentials.access_token) return fail('GITHUB_AUTH_FAILED', 'GitHub authorization failed. Please try again.', 400);
        const account = await github(credentials.access_token, '/user');
        const encrypted = await encryptSecret(env.MONITOR_ENCRYPTION_KEY!, credentials.access_token);
        const saved = await db!.from('monitor_github_accounts').upsert({ user_id: userId, login: account.login, token_ciphertext: encrypted.ciphertext, token_iv: encrypted.iv });
        if (saved.error) return fail('SERVER_ERROR', 'Could not save your GitHub connection.', 500);
        return ok({ login: account.login });
      }
      const { data: account, error: accountError } = await db!.from('monitor_github_accounts').select('token_ciphertext, token_iv').eq('user_id', userId).maybeSingle();
      if (accountError) return fail('NOT_CONFIGURED', 'GitHub storage needs to be configured.', 501);
      if (!account) return fail('GITHUB_AUTH_REQUIRED', 'Connect your GitHub account.', 401);
      const accessToken = await decryptSecret(env.MONITOR_ENCRYPTION_KEY!, account.token_ciphertext, account.token_iv);
      if (path === '/github/repos' && request.method === 'GET') {
        const repos: any[] = [];
        for (let page = 1; ; page++) {
          const batch = await github(accessToken, `/user/repos?per_page=100&sort=updated&page=${page}`);
          repos.push(...batch.map((r: any) => ({ id: r.id, fullName: r.full_name, private: r.private, defaultBranch: r.default_branch, updatedAt: r.updated_at ?? null })));
          if (batch.length < 100) break;
        }
        return ok(repos);
      }
      const body = request.method === 'POST' ? await request.json() as any : null;
      const repository = path === '/github/branches' ? url.searchParams.get('repo') : body?.repository;
      if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return fail('INVALID_REPO', 'Choose a valid GitHub repository.', 400);
      if (path === '/github/branches' && request.method === 'GET') {
        const branches: string[] = [];
        for (let page = 1; ; page++) {
          const batch = await github(accessToken, `/repos/${repository}/branches?per_page=100&page=${page}`);
          branches.push(...batch.map((b: any) => b.name));
          if (batch.length < 100) break;
        }
        return ok(branches);
      }
      if (path === '/projects' && request.method === 'POST') {
        if (body.source !== 'github' || typeof body.branch !== 'string' || !body.branch || body.branch.length > 255) return fail('INVALID_PROJECT', 'Choose a GitHub repository and branch.', 400);
        const repositoryInfo = await github(accessToken, `/repos/${repository}`);
        await github(accessToken, `/repos/${repository}/branches/${encodeURIComponent(body.branch)}`);
        const { data, error } = await db!.from('monitor_projects').upsert({ user_id: userId, source: 'github', name: repositoryInfo.name, repository: repositoryInfo.full_name, branch: body.branch,
          status: 'syncing', workspace_id: `github:${repositoryInfo.id}:${body.branch}` }, { onConflict: 'user_id,workspace_id' }).select('id, source, name, repository, branch, status').single();
        if (error) return fail('SERVER_ERROR', 'Could not save the selected project.', 500);
        return ok(data);
      }
      return fail('NOT_FOUND', 'Not found.', 404);
    } catch {
      return fail('GITHUB_UNAVAILABLE', 'GitHub could not complete this request. Check repository access or reconnect and try again.', 502);
    }
  }

  const loadKeys = async () => {
    const { data, error } = await db!.from('monitor_provider_keys').select('provider, key_ciphertext, key_iv, key_last4').eq('user_id', userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as { provider: ProviderId; key_ciphertext: string; key_iv: string; key_last4: string }[];
  };

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
