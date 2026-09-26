/**
 * Collects real, publicly-visible TikTok profile data for one username.
 *
 * This fetches the same public profile page (`tiktok.com/@username`) any
 * signed-out visitor's browser would load, and reads the JSON TikTok's own
 * server embeds in that page to render it (a `<script>` block, not a
 * private/authenticated API) — the same category of technique as reading
 * OpenGraph tags or JSON-LD off a public page. No login, no cookies, no
 * private or undocumented app endpoints, no bypassing any access control:
 * if the profile isn't public, there's nothing here to read.
 *
 * TikTok does not publish this page structure as a stable contract, so it
 * can change without notice — `parseEmbeddedState` below is kept isolated
 * and pure specifically so it can be re-verified/fixed against a fresh page
 * sample without touching fetch/caching/auth logic elsewhere.
 *
 * This module never writes to the database and never touches Launchly
 * subscription/billing logic — see creatorSearchService.ts for that.
 */

const PROFILE_URL = (username: string) => `https://www.tiktok.com/@${encodeURIComponent(username)}`;
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB — a profile page is a few hundred KB
const MAX_VIDEOS = 12;

export class CreatorNotFoundError extends Error {}
export class CollectorUnavailableError extends Error {}

export interface RawCreatorVideo {
  id: string | null;
  description: string | null;
  cover: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  publishedAt: string | null;
}

export interface RawCreatorProfile {
  platformCreatorId: string | null;
  username: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  likes: number | null;
  videoCount: number | null;
  videos: RawCreatorVideo[];
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Extract the `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON block TikTok embeds
 * in the public profile page's server-rendered HTML. Returns null (never
 * throws) if the page no longer contains it in the expected shape — callers
 * fall back to OpenGraph parsing.
 */
export function parseEmbeddedState(html: string): any | null {
  const match = html.match(
    /<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** OpenGraph fallback — coarser, but far more stable than the hydration blob. */
export function parseOpenGraphProfile(html: string): { displayName: string | null; avatar: string | null; bio: string | null } {
  const og = (prop: string) => {
    const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`, 'i'));
    return m ? m[1] : null;
  };
  return {
    displayName: og('title'),
    avatar: og('image'),
    bio: og('description'),
  };
}

function extractProfileFromState(state: any, username: string): RawCreatorProfile | null {
  const scope = state?.__DEFAULT_SCOPE__;
  const userDetail = scope?.['webapp.user-detail'];
  const userInfo = userDetail?.userInfo;
  const user = userInfo?.user;
  const stats = userInfo?.stats;
  if (!user) return null;

  const rawItems: any[] =
    scope?.['webapp.user-detail']?.itemList ??
    scope?.['webapp.video-list']?.itemList ??
    [];

  const videos: RawCreatorVideo[] = (Array.isArray(rawItems) ? rawItems : [])
    .slice(0, MAX_VIDEOS)
    .map((item) => ({
      id: str(item?.id),
      description: str(item?.desc),
      cover: str(item?.video?.cover ?? item?.video?.originCover),
      views: num(item?.stats?.playCount),
      likes: num(item?.stats?.diggCount),
      comments: num(item?.stats?.commentCount),
      shares: num(item?.stats?.shareCount),
      publishedAt:
        typeof item?.createTime === 'number'
          ? new Date(item.createTime * 1000).toISOString()
          : null,
    }));

  return {
    platformCreatorId: str(user.id),
    username: str(user.uniqueId) ?? username,
    displayName: str(user.nickname),
    avatar: str(user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb),
    bio: str(user.signature),
    followers: num(stats?.followerCount),
    following: num(stats?.followingCount),
    likes: num(stats?.heartCount ?? stats?.heart),
    videoCount: num(stats?.videoCount),
    videos,
  };
}

/**
 * Fetch and parse one creator's public profile. Throws CreatorNotFoundError
 * for a genuine 404/removed profile, CollectorUnavailableError for anything
 * else that stops a real result being produced (timeout, block page, changed
 * markup) — callers must not invent data for either case.
 */
export async function collectTikTokProfile(username: string): Promise<RawCreatorProfile> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(PROFILE_URL(username), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
  } catch (err) {
    throw new CollectorUnavailableError(
      err instanceof Error && err.name === 'AbortError' ? 'Profile fetch timed out.' : 'Profile fetch failed.'
    );
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 404) {
    throw new CreatorNotFoundError(`No public TikTok profile for @${username}.`);
  }
  if (!res.ok) {
    throw new CollectorUnavailableError(`Profile page returned HTTP ${res.status}.`);
  }

  const contentLength = Number(res.headers.get('content-length') ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new CollectorUnavailableError('Profile page response too large.');
  }

  const html = await res.text();
  if (html.length > MAX_RESPONSE_BYTES) {
    throw new CollectorUnavailableError('Profile page response too large.');
  }

  const state = parseEmbeddedState(html);
  const fromState = state ? extractProfileFromState(state, username) : null;
  if (fromState) return fromState;

  // Structured state missing/changed shape — fall back to OpenGraph so a
  // profile that clearly exists (page loaded, isn't a 404) still returns
  // something real rather than nothing at all.
  const og = parseOpenGraphProfile(html);
  if (!og.displayName && !og.avatar && !og.bio) {
    throw new CollectorUnavailableError('Could not read profile data from the public page.');
  }

  return {
    platformCreatorId: null,
    username,
    displayName: og.displayName,
    avatar: og.avatar,
    bio: og.bio,
    followers: null,
    following: null,
    likes: null,
    videoCount: null,
    videos: [],
  };
}
