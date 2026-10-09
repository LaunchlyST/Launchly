import { WORKER_URL } from '../../lib/workerUrl';
import type { TikTokProfile } from './store';

/**
 * TikTok Login Kit + Display API sync engine (frontend half).
 *
 * - OAuth + token refresh + `/v2/user/info/` calls run on the Cloudflare
 *   Worker; the browser never sees TikTok tokens.
 * - Requested scopes: `user.info.basic` (avatar + display name) and
 *   `user.info.profile` (username + bio).
 * - `open_id` is the stable account id — username changes never break sync.
 * - Failures keep the last good profile and surface a warning only.
 */

export const TIKTOK_SCOPES = 'user.info.basic,user.info.profile';
export const SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const MIN_MANUAL_SYNC_MS = 60 * 1000;

export interface TikTokSyncResult {
  ok: boolean;
  profile: TikTokProfile | null;
  error: string | null;
  configured: boolean;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function normalizeTikTokProfile(raw: any): TikTokProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = (raw as any).data?.user ?? raw;
  const openId = clean(data.open_id ?? data.openId);
  if (!openId) return null;
  // Never invent identity: empty strings stay empty; merge logic decides.
  return {
    openId,
    username: clean(data.username ?? data.handle).replace(/^@+/, ''),
    displayName: clean(data.display_name ?? data.displayName),
    avatar: clean(data.avatar_url ?? data.avatar ?? data.avatar_large_url),
    bio: typeof (data.bio_description ?? data.bio) === 'string' ? ((data.bio_description ?? data.bio) as string) : '',
  };
}

export function shouldAutoSync(lastSyncAt: string | null, now = Date.now()): boolean {
  if (!lastSyncAt) return true;
  const t = Date.parse(lastSyncAt);
  if (!Number.isFinite(t)) return true;
  return now - t >= SYNC_INTERVAL_MS;
}

export function canManualSync(lastSyncAt: string | null, now = Date.now()): boolean {
  if (!lastSyncAt) return true;
  const t = Date.parse(lastSyncAt);
  if (!Number.isFinite(t)) return true;
  return now - t >= MIN_MANUAL_SYNC_MS;
}

async function workerFetch(path: string, init?: RequestInit): Promise<{ res: Response; json: any }> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { res, json };
}

/** Backend URL that starts TikTok Login Kit OAuth for this user. */
export async function getTikTokAuthUrl(userId: string): Promise<{ url: string | null; configured: boolean }> {
  try {
    const { res, json } = await workerFetch('/api/tiktok/auth-url', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return { url: null, configured: json?.configured !== false };
    return { url: typeof json?.url === 'string' ? json.url : null, configured: true };
  } catch {
    return { url: null, configured: true };
  }
}

/**
 * Fetch the latest TikTok profile via the Worker (`/v2/user/info/`).
 * Returns ok:false on any failure — callers must keep the last good profile.
 */
export async function fetchTikTokProfile(userId: string): Promise<TikTokSyncResult> {
  try {
    const { res, json } = await workerFetch(`/api/tiktok/profile?userId=${encodeURIComponent(userId)}`);
    if (res.status === 501 || json?.configured === false) {
      return { ok: false, profile: null, error: 'TikTok API not configured yet', configured: false };
    }
    if (!res.ok || !json?.ok) {
      const msg =
        typeof json?.error === 'string' && json.error.trim()
          ? json.error
          : `Sync failed (${res.status || 'network'})`;
      // 429 / 5xx are transient — keep serving the last good profile.
      const stale = normalizeTikTokProfile(json?.profile ?? null);
      return { ok: false, profile: stale, error: msg, configured: true };
    }
    const profile = normalizeTikTokProfile(json.profile ?? json);
    if (!profile) return { ok: false, profile: null, error: 'Empty profile response', configured: true };
    // Guard: a response with no identity fields at all is treated as failure.
    if (!profile.username && !profile.displayName && !profile.avatar) {
      return { ok: false, profile: null, error: 'Empty profile response', configured: true };
    }
    return { ok: true, profile, error: null, configured: true };
  } catch (e: any) {
    return { ok: false, profile: null, error: e?.message || 'Network error', configured: true };
  }
}

export function formatLastSync(iso: string | null): string {
  if (!iso) return 'Not synced yet';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Not synced yet';
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Synced just now';
  if (diff < 3_600_000) {
    const m = Math.max(1, Math.round(diff / 60_000));
    return `Synced ${m} min ago`;
  }
  try {
    return `Synced ${new Date(t).toLocaleString()}`;
  } catch {
    return 'Synced';
  }
}
