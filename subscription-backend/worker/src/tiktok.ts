import { createClient } from '@supabase/supabase-js';

/**
 * TikTok Login Kit (OAuth) + Display API (`/v2/user/info/`) — backend half.
 *
 * Design:
 * - Requested scopes: `user.info.basic` (avatar + display name) and
 *   `user.info.profile` (username + bio).
 * - `open_id` is the stable account identifier; username changes never
 *   break the connection.
 * - Access/refresh tokens live ONLY in Supabase (service-role) — the
 *   browser only ever receives safe profile fields.
 * - Respects TikTok rate limits: profile reads are cached per user
 *   (60s min interval server-side) and scheduled sync batches via cron.
 * - Failures never wipe identity: rows keep the last good profile and
 *   only record `sync_error` + `last_synced_at` stays on last success.
 */

export interface TikTokEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_REDIRECT_URI?: string;
  FRONTEND_URL: string;
}

const SCOPES = 'user.info.basic,user.info.profile';

function json(data: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function db(env: TikTokEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function configured(env: TikTokEnv): boolean {
  return !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_REDIRECT_URI);
}

export function isTikTokRoute(pathname: string): boolean {
  return pathname.startsWith('/api/tiktok/');
}

export async function handleTikTok(
  request: Request,
  env: TikTokEnv,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);

  // GET /api/tiktok/status?userId= — connection state without secrets.
  if (url.pathname === '/api/tiktok/status' && request.method === 'GET') {
    const userId = url.searchParams.get('userId') || '';
    if (!userId) return json({ error: 'Missing userId' }, 400, corsHeaders);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
      return json({ connected: false, configured: configured(env) }, 200, corsHeaders);
    const supa = db(env);
    const { data } = await supa
      .from('tiktok_connections')
      .select('open_id, username, display_name, avatar_url, bio, last_synced_at, sync_error')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return json({ connected: false, configured: configured(env) }, 200, corsHeaders);
    return json(
      {
        connected: true,
        configured: configured(env),
        profile: {
          open_id: (data as any).open_id,
          username: (data as any).username ?? '',
          display_name: (data as any).display_name ?? '',
          avatar_url: (data as any).avatar_url ?? '',
          bio: (data as any).bio ?? '',
        },
        lastSyncedAt: (data as any).last_synced_at ?? null,
        syncError: (data as any).sync_error ?? null,
      },
      200,
      corsHeaders
    );
  }

  // POST /api/tiktok/auth-url { userId } — start Login Kit OAuth.
  if (url.pathname === '/api/tiktok/auth-url' && request.method === 'POST') {
    if (!configured(env))
      return json(
        { error: 'TikTok Login Kit is not configured', configured: false },
        501,
        corsHeaders
      );
    const body = (await request.json().catch(() => ({}))) as { userId?: string };
    if (!body.userId) return json({ error: 'Missing userId' }, 400, corsHeaders);
    const state = `${body.userId}.${crypto.randomUUID()}`;
    const auth = new URL('https://www.tiktok.com/v2/auth/authorize/');
    auth.searchParams.set('client_key', env.TIKTOK_CLIENT_KEY!);
    auth.searchParams.set('scope', SCOPES);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('redirect_uri', env.TIKTOK_REDIRECT_URI!);
    auth.searchParams.set('state', state);
    return json({ url: auth.toString(), configured: true }, 200, corsHeaders);
  }

  // GET /api/tiktok/callback?code=&state= — TikTok redirects here.
  if (url.pathname === '/api/tiktok/callback' && request.method === 'GET') {
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const userId = state.split('.')[0] || '';
    if (!code || !userId) return Response.redirect(`${env.FRONTEND_URL}/dashboard?store=connect-error`, 302);
    if (!configured(env)) return Response.redirect(`${env.FRONTEND_URL}/dashboard?store=connect-error`, 302);
    try {
      const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: env.TIKTOK_CLIENT_KEY!,
          client_secret: env.TIKTOK_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: env.TIKTOK_REDIRECT_URI!,
        }),
      });
      const token = (await tokenRes.json().catch(() => null)) as any;
      const accessToken = token?.access_token;
      const refreshToken = token?.refresh_token;
      const openId = token?.open_id;
      const expiresIn = Number(token?.expires_in) || 86400;
      if (!tokenRes.ok || !accessToken || !openId) throw new Error('Token exchange failed');
      const profile = await fetchTikTokUserInfo(accessToken, openId);
      const supa = db(env);
      await supa.from('tiktok_connections').upsert(
        {
          user_id: userId,
          open_id: openId,
          username: profile.username,
          display_name: profile.displayName,
          avatar_url: profile.avatar,
          bio: profile.bio,
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
          expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          last_synced_at: new Date().toISOString(),
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (e) {
      console.error('TikTok callback failed:', e);
      return Response.redirect(`${env.FRONTEND_URL}/dashboard?store=connect-error`, 302);
    }
    return Response.redirect(`${env.FRONTEND_URL}/dashboard?store=connected`, 302);
  }

  // GET /api/tiktok/profile?userId= — latest profile (refreshes when stale).
  if (url.pathname === '/api/tiktok/profile' && request.method === 'GET') {
    const userId = url.searchParams.get('userId') || '';
    if (!userId) return json({ error: 'Missing userId' }, 400, corsHeaders);
    if (!configured(env)) return json({ error: 'TikTok API not configured', configured: false }, 501, corsHeaders);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
      return json({ error: 'Storage not configured' }, 503, corsHeaders);
    const supa = db(env);
    const { data: row } = await supa.from('tiktok_connections').select('*').eq('user_id', userId).maybeSingle();
    if (!row) return json({ error: 'TikTok not connected', configured: true }, 404, corsHeaders);
    // Server-side throttle: at most one live TikTok call per minute per user.
    const last = Date.parse((row as any).profile_fetched_at ?? (row as any).last_synced_at ?? '') || 0;
    if (Date.now() - last < 60_000) {
      return json({ ok: true, profile: toClientProfile(row), cached: true }, 200, corsHeaders);
    }
    try {
      const accessToken = await ensureAccessToken(supa, env, row);
      const profile = await fetchTikTokUserInfo(accessToken, (row as any).open_id);
      // Only overwrite with real values — empty payload keeps last profile.
      const patch: Record<string, unknown> = {
        profile_fetched_at: new Date().toISOString(),
        sync_error: null,
        updated_at: new Date().toISOString(),
      };
      if (profile.username) patch.username = profile.username;
      if (profile.displayName) patch.display_name = profile.displayName;
      if (profile.avatar) patch.avatar_url = profile.avatar;
      if (profile.bio !== undefined) patch.bio = profile.bio;
      if (profile.username || profile.displayName || profile.avatar) {
        patch.last_synced_at = new Date().toISOString();
      }
      await supa.from('tiktok_connections').update(patch).eq('user_id', userId);
      const { data: fresh } = await supa.from('tiktok_connections').select('*').eq('user_id', userId).maybeSingle();
      return json({ ok: true, profile: toClientProfile(fresh ?? row) }, 200, corsHeaders);
    } catch (e: any) {
      const transient = /429|5\d\d|network|timeout/i.test(String(e?.message));
      await supa
        .from('tiktok_connections')
        .update({ sync_error: String(e?.message ?? 'Sync failed'), updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      // Keep last good profile — signal stale so UI warns instead of blanking.
      return json(
        { ok: false, error: String(e?.message ?? 'Sync failed'), transient, profile: toClientProfile(row), stale: true },
        transient ? 429 : 502,
        corsHeaders
      );
    }
  }

  // POST /api/tiktok/disconnect { userId } — remove connection (store keeps last profile text).
  if (url.pathname === '/api/tiktok/disconnect' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as { userId?: string };
    if (!body.userId) return json({ error: 'Missing userId' }, 400, corsHeaders);
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const supa = db(env);
      await supa.from('tiktok_connections').delete().eq('user_id', body.userId);
    }
    return json({ ok: true }, 200, corsHeaders);
  }

  return json({ error: 'Not found' }, 404, corsHeaders);
}

function toClientProfile(row: any) {
  return {
    open_id: row?.open_id ?? '',
    username: row?.username ?? '',
    display_name: row?.display_name ?? '',
    avatar_url: row?.avatar_url ?? '',
    bio: row?.bio ?? '',
  };
}

async function ensureAccessToken(supa: ReturnType<typeof db>, env: TikTokEnv, row: any): Promise<string> {
  const expires = Date.parse(row.expires_at ?? '') || 0;
  if (row.access_token && expires - Date.now() > 5 * 60_000) return row.access_token;
  if (!row.refresh_token || !configured(env)) {
    // No refresh possible — use current token; TikTok call decides freshness.
    if (row.access_token) return row.access_token;
    throw new Error('TikTok session expired — reconnect required');
  }
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY!,
      client_secret: env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }),
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok || !data?.access_token) throw new Error('Token refresh failed');
  const expiresIn = Number(data.expires_in) || 86400;
  await supa
    .from('tiktok_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? row.refresh_token,
      open_id: data.open_id ?? row.open_id,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', row.user_id);
  return data.access_token;
}

async function fetchTikTokUserInfo(
  accessToken: string,
  openId: string
): Promise<{ username: string; displayName: string; avatar: string; bio: string }> {
  // Official Display API. `user.info.basic` → avatar/display name,
  // `user.info.profile` → username/bio.
  const fields = 'open_id,username,display_name,avatar_url,bio_description';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) throw new Error('TikTok rate limit (429) — trying again later');
    if (!res.ok) throw new Error(`TikTok API error (${res.status})`);
    const body = (await res.json().catch(() => null)) as any;
    if (body?.error?.code !== 'ok') throw new Error(body?.error?.message || 'TikTok API error');
    const user = body?.data?.user ?? {};
    void openId;
    return {
      username: typeof user.username === 'string' ? user.username.replace(/^@+/, '') : '',
      displayName: typeof user.display_name === 'string' ? user.display_name : '',
      avatar: typeof user.avatar_url === 'string' ? user.avatar_url : '',
      bio: typeof user.bio_description === 'string' ? user.bio_description : '',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Cron sync (every 15 min): refresh rows whose last success is stale.
 * Register in wrangler: `[triggers] crons = ["*\/15 * * * *"]`.
 */
export async function scheduledTikTokSync(env: TikTokEnv): Promise<void> {
  if (!configured(env) || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const supa = db(env);
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: rows } = await supa
    .from('tiktok_connections')
    .select('user_id, open_id, access_token, refresh_token, expires_at')
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .limit(100);
  for (const row of (rows ?? []) as any[]) {
    try {
      const accessToken = await ensureAccessToken(supa, env, row);
      const profile = await fetchTikTokUserInfo(accessToken, row.open_id);
      const patch: Record<string, unknown> = {
        profile_fetched_at: new Date().toISOString(),
        sync_error: null,
        updated_at: new Date().toISOString(),
      };
      if (profile.username) patch.username = profile.username;
      if (profile.displayName) patch.display_name = profile.displayName;
      if (profile.avatar) patch.avatar_url = profile.avatar;
      if (profile.bio !== undefined) patch.bio = profile.bio;
      if (profile.username || profile.displayName || profile.avatar) patch.last_synced_at = new Date().toISOString();
      await supa.from('tiktok_connections').update(patch).eq('user_id', row.user_id);
    } catch (e: any) {
      await supa
        .from('tiktok_connections')
        .update({ sync_error: String(e?.message ?? 'Sync failed'), updated_at: new Date().toISOString() })
        .eq('user_id', (row as any).user_id);
    }
    // Gentle pacing between users to respect TikTok limits.
    await new Promise((r) => setTimeout(r, 300));
  }
}
