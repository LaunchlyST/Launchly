import type { Business, BusinessSearchParams, EnrichedBusiness, SocialPlatform, WebsiteInspection } from './businessTypes.ts';
import { SOCIAL_PLATFORMS } from './businessTypes.ts';
import type { BusinessDataProvider } from './businessDataProvider.ts';
import { CityNotFoundError, InvalidBusinessIdError } from './businessDataProvider.ts';
import { estimateAdBudget, type BudgetContext } from './adBudget.ts';
import { inferBusinessNeeds } from './businessNeeds.ts';
import { BusinessCache, RateLimiter, searchCacheKey, TTL } from './businessCache.ts';
import type { BusinessStore } from './businessStore.ts';
import { evidenceToProfiles, mergeSocialEvidence } from './socialDiscovery.ts';
import { getCategory, COUNTRIES } from './businessCategories.ts';
import { UpstreamError, UpstreamTimeoutError } from './httpUtil.ts';

/**
 * Business Connect HTTP handlers. All dependencies are injected so the whole
 * request path (auth → rate limit → cache → provider → store) is testable
 * without the network; see businessRoutes.ts for the production wiring.
 */

export interface TikTokPreview {
  username: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  likes: number | null;
  videos: { id: string | null; cover: string | null; description: string | null; views: number | null }[];
}

export interface ProfilePagePreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  embeddable: boolean;
}

export interface BusinessApiDeps {
  getUserId(request: Request): Promise<string | null>;
  searchProvider(): BusinessDataProvider;
  providerForId(id: string): BusinessDataProvider;
  cache: BusinessCache;
  limiter: RateLimiter;
  store: BusinessStore | null;
  inspectWebsite(url: string): Promise<WebsiteInspection>;
  inspectProfilePage(url: string): Promise<ProfilePagePreview>;
  lookupTikTok(username: string): Promise<TikTokPreview | null>;
  fetchPhoto?(name: string): Promise<Response>;
  emailStatus(): { configured: boolean; provider: 'gmail' };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function ok(data: unknown, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ success: true, ...extra, data }), { status: 200, headers: { ...CORS, ...headers } });
}

function fail(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: { code, message } }), { status, headers: CORS });
}

const ROUTE = /^\/api\/businesses\/([^/]+)(?:\/(social|preview|save|notes|outreach))?$/;

export function isBusinessRoute(pathname: string): boolean {
  return pathname.startsWith('/api/businesses') || pathname === '/api/email/status';
}

function enrich(b: Business, ctx: BudgetContext = {}, inspection?: WebsiteInspection | null): EnrichedBusiness {
  const merged = inspection ? mergeSocialEvidence(b.socialEvidence, inspection.socials) : b.socialEvidence;
  const withSocial: Business = {
    ...b,
    socialEvidence: merged,
    socialProfiles: evidenceToProfiles(merged),
    email: b.email ?? inspection?.emails[0] ?? null,
  };
  return { ...withSocial, budget: estimateAdBudget(withSocial, ctx), needs: inferBusinessNeeds(withSocial, inspection) };
}

/** Strip internal provenance before a business is sent to the browser. */
function publicBusiness(b: EnrichedBusiness) {
  const { socialEvidence: _e, ...rest } = b;
  return rest;
}

export function parseSearchParams(url: URL): { ok: true; params: BusinessSearchParams } | { ok: false; message: string } {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  const country = (url.searchParams.get('country') ?? '').trim().toUpperCase();
  const city = (url.searchParams.get('city') ?? '').trim().slice(0, 80);
  const type = (url.searchParams.get('type') ?? '').trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '30', 10) || 30, 1), 50);

  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, message: 'country must be a 2-letter ISO code, e.g. GB.' };
  if (!COUNTRIES.some((c) => c.code === country)) return { ok: false, message: `Country ${country} is not supported yet.` };
  if (city.length < 2) return { ok: false, message: 'city is required.' };
  if (/[<>{}"\\]/.test(city) || /[<>{}"\\]/.test(q)) return { ok: false, message: 'Invalid characters in search.' };
  if (type && !getCategory(type)) return { ok: false, message: `Unknown business type "${type}".` };
  if (!type && q.length < 2) return { ok: false, message: 'Choose a business type or enter a search term.' };
  return { ok: true, params: { q, country, city, type, limit } };
}

function upstreamFailure(err: unknown): Response {
  if (err instanceof CityNotFoundError) return fail('CITY_NOT_FOUND', 'We could not find that city in that country.', 404);
  if (err instanceof InvalidBusinessIdError) return fail('INVALID_BUSINESS_ID', 'Invalid business id.', 400);
  if (err instanceof UpstreamTimeoutError) return fail('UPSTREAM_TIMEOUT', 'The business data source took too long. Please retry.', 504);
  if (err instanceof UpstreamError) {
    return err.status === 429
      ? fail('UPSTREAM_RATE_LIMITED', 'The business data source is busy. Please retry in a minute.', 503)
      : fail('UPSTREAM_UNAVAILABLE', 'The business data source is unavailable. Please retry.', 502);
  }
  console.error('[business-connect] unexpected error', err instanceof Error ? err.message : err);
  return fail('SERVER_ERROR', 'Something went wrong handling this request.', 500);
}

export async function handleBusinessRequest(request: Request, deps: BusinessApiDeps): Promise<Response> {
  const url = new URL(request.url);

  // <img> tags can't send a bearer token, so the photo proxy is public but
  // rate limited per client IP. It only ever serves provider photos.
  if (url.pathname === '/api/businesses/photo' && request.method === 'GET') {
    const ip = request.headers.get('cf-connecting-ip') ?? 'anon';
    if (!(await deps.limiter.allow(`ip:${ip}`))) return fail('RATE_LIMITED', 'Too many requests.', 429);
    const name = url.searchParams.get('name') ?? '';
    if (!/^places\/[A-Za-z0-9_\-]+\/photos\/[A-Za-z0-9_\-]+$/.test(name) || !deps.fetchPhoto) {
      return fail('INVALID_PHOTO', 'Photo not available.', 404);
    }
    try {
      return await deps.fetchPhoto(name);
    } catch (err) {
      return upstreamFailure(err);
    }
  }

  const userId = await deps.getUserId(request);
  if (!userId) return fail('UNAUTHENTICATED', 'Sign in required.', 401);

  if (!(await deps.limiter.allow(userId))) {
    return fail('RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.', 429);
  }

  try {
    if (url.pathname === '/api/email/status' && request.method === 'GET') {
      // No mailbox integration is live yet — never report a connection that doesn't exist.
      const s = deps.emailStatus();
      return ok({ connected: false, provider: s.provider, configured: s.configured, account: null });
    }

    if (url.pathname === '/api/businesses/search' && request.method === 'GET') {
      const parsed = parseSearchParams(url);
      if (!parsed.ok) return fail('INVALID_QUERY', parsed.message, 400);
      const provider = deps.searchProvider();
      const key = searchCacheKey(parsed.params, provider.name);
      const { value, cached } = await deps.cache.wrap(key, TTL.search, async () => {
        const raw = await provider.search(parsed.params);
        const ctx: BudgetContext = { localCompetitors: raw.length };
        const enriched = raw.map((b) => enrich(b, ctx));
        // Each business is cached on its own too, so opening one is free.
        await Promise.all(enriched.map((b) => deps.cache.set(`biz|${b.id}`, b, TTL.business)));
        return enriched;
      });
      return ok(value.map(publicBusiness), { provider: provider.name, cached, count: value.length });
    }

    if (url.pathname === '/api/businesses/saved' && request.method === 'GET') {
      if (!deps.store) return fail('STORAGE_UNAVAILABLE', 'Saving is not configured.', 503);
      return ok(await deps.store.listLeads(userId));
    }

    const m = url.pathname.match(ROUTE);
    if (!m) return fail('NOT_FOUND', 'Not found.', 404);
    let id: string;
    try {
      id = decodeURIComponent(m[1]);
    } catch {
      return fail('INVALID_BUSINESS_ID', 'Invalid business id.', 400);
    }
    if (!/^(osm:(node|way|relation):\d+|google:[A-Za-z0-9_\-]+)$/.test(id)) {
      return fail('INVALID_BUSINESS_ID', 'Invalid business id.', 400);
    }
    const action = m[2] ?? 'details';

    const loadBusiness = async (): Promise<EnrichedBusiness | null> => {
      const hit = await deps.cache.get<EnrichedBusiness>(`biz|${id}`);
      if (hit) return hit;
      const b = await deps.providerForId(id).getById(id);
      if (!b) return null;
      const e = enrich(b);
      await deps.cache.set(`biz|${id}`, e, TTL.business);
      return e;
    };

    const loadInspection = async (website: string | null) => {
      if (!website) return null;
      return (await deps.cache.wrap(`site|${website}`, TTL.website, () => deps.inspectWebsite(website))).value;
    };

    const business = await loadBusiness();
    if (!business) return fail('BUSINESS_NOT_FOUND', 'Business not found.', 404);

    if (action === 'details' && request.method === 'GET') {
      return ok(publicBusiness(business));
    }

    if (action === 'social' && request.method === 'GET') {
      const inspection = await loadInspection(business.website);
      const full = enrich(business, {}, inspection);
      return ok({
        business: publicBusiness(full),
        socialProfiles: full.socialProfiles,
        evidence: full.socialEvidence.map(({ platform, url: u, source, confidence }) => ({ platform, url: u, source, confidence })),
        email: full.email,
        emailSource: business.email ? 'provider' : full.email ? 'business_website' : null,
        needs: full.needs,
        website: inspection
          ? { ok: inspection.ok, domain: inspection.domain, title: inspection.title, embeddable: inspection.embeddable }
          : null,
      });
    }

    if (action === 'preview' && request.method === 'GET') {
      const platform = url.searchParams.get('platform') ?? 'website';
      if (platform === 'website') {
        if (!business.website) return fail('NO_WEBSITE', 'No website listed for this business.', 404);
        const i = await loadInspection(business.website);
        return ok({
          kind: 'website',
          url: i?.finalUrl ?? business.website,
          domain: i?.domain ?? null,
          reachable: !!i?.ok,
          embeddable: !!i?.embeddable,
          title: i?.title ?? null,
          description: i?.description ?? null,
          favicon: i?.favicon ?? null,
          image: i?.image ?? null,
          keyLinks: i?.keyLinks ?? [],
        });
      }
      if (!SOCIAL_PLATFORMS.includes(platform as SocialPlatform)) {
        return fail('INVALID_PLATFORM', 'Unknown platform.', 400);
      }
      const inspection = await loadInspection(business.website);
      const full = enrich(business, {}, inspection);
      const evidence = full.socialEvidence.find((e) => e.platform === platform);
      if (!evidence) {
        return fail('PROFILE_NOT_FOUND', `${platform === 'tiktok' ? 'TikTok' : platform} profile not found`, 404);
      }
      if (platform === 'tiktok') {
        const username = evidence.username;
        const profile = username
          ? (await deps.cache.wrap(`tt|${username.toLowerCase()}`, TTL.profile, () => deps.lookupTikTok(username))).value
          : null;
        return ok({ kind: 'tiktok', url: evidence.url, source: evidence.source, embeddable: false, profile });
      }
      const page = (await deps.cache.wrap(`page|${evidence.url}`, TTL.profile, () => deps.inspectProfilePage(evidence.url))).value;
      return ok({ ...page, kind: 'profile', platform, url: evidence.url, source: evidence.source, username: evidence.username });
    }

    // ---- per-user writes ----
    if (!deps.store) return fail('STORAGE_UNAVAILABLE', 'Saving is not configured.', 503);
    const store = deps.store;

    if (action === 'save' && request.method === 'POST') {
      return ok(await store.saveLead(userId, business));
    }

    if (action === 'notes') {
      if (request.method === 'GET') {
        const lead = await store.getLead(userId, id);
        return ok(lead ? await store.listNotes(userId, lead.id) : []);
      }
      if (request.method === 'POST') {
        const body = await request.json().catch(() => null) as { content?: unknown } | null;
        const content = typeof body?.content === 'string' ? body.content.trim() : '';
        if (!content || content.length > 5000) return fail('INVALID_NOTE', 'A note needs 1–5000 characters.', 400);
        const lead = await store.saveLead(userId, business);
        return ok(await store.addNote(userId, lead.id, content));
      }
    }

    if (action === 'outreach') {
      if (request.method === 'GET') {
        const lead = await store.getLead(userId, id);
        return ok(lead ? await store.listOutreach(userId, lead.id) : []);
      }
      if (request.method === 'POST') {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const intent = body?.intent;
        const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, 300) : '';
        const text = typeof body?.body === 'string' ? body.body.trim().slice(0, 20000) : '';
        const channel = body?.channel === 'message' ? 'message' : 'email';

        if (intent === 'send') {
          // Real delivery needs a connected mailbox. Until one is connected we
          // refuse rather than pretend the email went out.
          return fail('EMAIL_NOT_CONNECTED', 'Connect your Gmail account to send email from Launchly.', 409);
        }
        if (intent === 'draft') {
          if (!text) return fail('INVALID_OUTREACH', 'Write a message before saving a draft.', 400);
          const lead = await store.saveLead(userId, business);
          return ok(await store.addOutreach(userId, lead.id, { channel, subject: subject || null, body: text, status: 'draft', scheduledFor: null }));
        }
        if (intent === 'follow_up') {
          const when = typeof body?.scheduledFor === 'string' ? new Date(body.scheduledFor) : null;
          if (!when || Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
            return fail('INVALID_FOLLOW_UP', 'Pick a follow-up date in the future.', 400);
          }
          const lead = await store.saveLead(userId, business);
          return ok(
            await store.addOutreach(userId, lead.id, {
              channel: 'follow_up',
              subject: subject || null,
              body: text || 'Follow up',
              status: 'scheduled',
              scheduledFor: when.toISOString(),
            })
          );
        }
        return fail('INVALID_OUTREACH', 'intent must be draft, send or follow_up.', 400);
      }
    }

    return fail('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
  } catch (err) {
    return upstreamFailure(err);
  }
}
