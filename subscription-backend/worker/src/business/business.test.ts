import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOsmElement, normalizeGooglePlace, buildOverpassQuery, OpenStreetMapProvider } from './businessDataProvider.ts';
import { estimateAdBudget, formatBudget } from './adBudget.ts';
import { inferBusinessNeeds } from './businessNeeds.ts';
import { classifySocialUrl, mergeSocialEvidence, socialsFromHtml, socialsFromOsmTags } from './socialDiscovery.ts';
import { isEmbeddable, parseWebsiteHtml } from './websiteInspector.ts';
import { BusinessCache, RateLimiter } from './businessCache.ts';
import { MemoryBusinessStore } from './businessStore.ts';
import { handleBusinessRequest, parseSearchParams, type BusinessApiDeps } from './businessApi.ts';
import type { Business, WebsiteInspection } from './businessTypes.ts';

// Fixtures are test-only. Production never serves them.
function biz(partial: Partial<Business> = {}): Business {
  return {
    id: 'osm:node:1',
    provider: 'osm',
    name: 'Fixture Dental',
    category: 'Dentist',
    description: null,
    address: null,
    city: 'Chelmsford',
    country: 'GB',
    latitude: null,
    longitude: null,
    rating: null,
    reviewCount: null,
    phone: null,
    email: null,
    website: null,
    openingHours: null,
    photo: null,
    priceLevel: null,
    socialProfiles: { instagram: null, facebook: null, youtube: null, tiktok: null, linkedin: null },
    socialEvidence: [],
    ...partial,
  };
}

function inspection(partial: Partial<WebsiteInspection> = {}): WebsiteInspection {
  return {
    url: 'https://example.co.uk',
    finalUrl: 'https://example.co.uk/',
    domain: 'example.co.uk',
    ok: true,
    title: 'Example',
    description: 'desc',
    favicon: null,
    image: null,
    hasViewportMeta: true,
    hasMetaDescription: true,
    adSignals: [],
    emails: [],
    socials: [],
    keyLinks: [],
    embeddable: true,
    ...partial,
  };
}

// ---------------------------------------------------------- normalization

test('OSM normalization maps real tags and leaves unknown fields null', () => {
  const b = normalizeOsmElement(
    {
      type: 'node',
      id: 42,
      lat: 51.73,
      lon: 0.47,
      tags: {
        name: 'Fixture Dental',
        amenity: 'dentist',
        'addr:housenumber': '1',
        'addr:street': 'High Street',
        'addr:postcode': 'CM1 1AA',
        website: 'fixture-dental.co.uk',
        phone: '+44 1245 000000',
        'contact:instagram': 'fixturedental',
      },
    },
    'Chelmsford',
    'gb'
  )!;
  assert.equal(b.id, 'osm:node:42');
  assert.equal(b.category, 'Dentist');
  assert.equal(b.address, '1 High Street, CM1 1AA');
  assert.equal(b.city, 'Chelmsford');
  assert.equal(b.country, 'GB');
  assert.equal(b.website, 'https://fixture-dental.co.uk/');
  assert.equal(b.socialProfiles.instagram, 'https://www.instagram.com/fixturedental');
  assert.equal(b.rating, null);
  assert.equal(b.reviewCount, null);
  assert.equal(b.photo, null);
  assert.equal(b.email, null);
});

test('OSM elements without a name are dropped; missing fields stay null', () => {
  assert.equal(normalizeOsmElement({ type: 'node', id: 1, tags: { amenity: 'dentist' } }, null, null), null);
  const b = normalizeOsmElement({ type: 'way', id: 7, center: { lat: 1, lon: 2 }, tags: { name: 'X' } }, null, null)!;
  assert.equal(b.category, null);
  assert.equal(b.website, null);
  assert.equal(b.latitude, 1);
  assert.deepEqual(b.socialEvidence, []);
});

test('Google normalization reads rating/reviews and proxies photo', () => {
  const b = normalizeGooglePlace({
    id: 'abc_123',
    displayName: { text: 'Place' },
    rating: 4.6,
    userRatingCount: 88,
    priceLevel: 'PRICE_LEVEL_EXPENSIVE',
    addressComponents: [
      { types: ['postal_town'], longText: 'Chelmsford' },
      { types: ['country'], shortText: 'GB', longText: 'United Kingdom' },
    ],
    photos: [{ name: 'places/abc_123/photos/p1' }],
  })!;
  assert.equal(b.id, 'google:abc_123');
  assert.equal(b.rating, 4.6);
  assert.equal(b.reviewCount, 88);
  assert.equal(b.priceLevel, 3);
  assert.equal(b.city, 'Chelmsford');
  assert.equal(b.country, 'GB');
  assert.match(b.photo!, /^\/api\/businesses\/photo\?name=/);
  assert.equal(b.email, null);
});

test('Overpass query uses category tags and escapes the name filter', () => {
  const q = buildOverpassQuery([51, 0, 52, 1], 'dentist', 'smile"; out', 10);
  assert.match(q, /nwr\["amenity"="dentist"\]/);
  assert.match(q, /nwr\["healthcare"="dentist"\]/);
  assert.match(q, /smile\\"; out/);
});

test('OSM provider search: geocodes city then lists real businesses', async () => {
  const calls: string[] = [];
  const fakeFetch = (async (url: string) => {
    calls.push(String(url));
    if (String(url).includes('nominatim')) {
      return new Response(JSON.stringify([{ name: 'Chelmsford', boundingbox: ['51.6', '51.8', '0.3', '0.6'] }]), { status: 200 });
    }
    return new Response(
      JSON.stringify({ elements: [{ type: 'node', id: 5, tags: { name: 'A Dental', amenity: 'dentist', website: 'a.co.uk' } }, { type: 'node', id: 6, tags: { amenity: 'dentist' } }] }),
      { status: 200 }
    );
  }) as unknown as typeof fetch;
  const p = new OpenStreetMapProvider(fakeFetch);
  const r = await p.search({ q: '', country: 'GB', city: 'Chelmsford', type: 'dentist', limit: 10 });
  assert.equal(r.length, 1);
  assert.equal(r[0].name, 'A Dental');
  assert.equal(calls.length, 2);
});

// ---------------------------------------------------------- budget + needs

test('estimateAdBudget is deterministic, labelled estimated, and in local currency', () => {
  const a = estimateAdBudget(biz({ website: 'https://x.co.uk' }), { localCompetitors: 40 });
  const b = estimateAdBudget(biz({ website: 'https://x.co.uk' }), { localCompetitors: 40 });
  assert.deepEqual(a, b);
  assert.equal(a.estimated, true);
  assert.equal(a.currency, 'GBP');
  assert.ok(a.min < a.max);
  assert.ok(a.factors.some((f) => f.label.includes('competition')));
  assert.equal(estimateAdBudget(biz({ country: 'US' })).currency, 'USD');
});

test('estimateAdBudget: bigger, higher-tier businesses get a higher range', () => {
  const cafe = estimateAdBudget(biz({ category: 'Café', reviewCount: 10 }));
  const dentist = estimateAdBudget(biz({ category: 'Dentist', reviewCount: 600, website: 'https://d.co.uk' }));
  assert.ok(dentist.min > cafe.min);
  assert.ok(dentist.max > cafe.max);
  assert.match(formatBudget(dentist), /^£/);
});

test('needs: no website and no socials', () => {
  const needs = inferBusinessNeeds(biz());
  const types = needs.map((n) => n.type);
  assert.ok(types.includes('website'));
  assert.ok(types.includes('social_media'));
  for (const n of needs) {
    assert.ok(n.reason.length > 0);
    assert.ok(n.confidence > 0 && n.confidence <= 1);
  }
});

test('needs: poor website, low reviews, no ad tags', () => {
  const needs = inferBusinessNeeds(
    biz({ website: 'https://x.co.uk', reviewCount: 8 }),
    inspection({ hasViewportMeta: false, hasMetaDescription: false })
  );
  const types = needs.map((n) => n.type);
  assert.ok(types.includes('website_improvement'));
  assert.ok(types.includes('review_growth'));
  assert.ok(types.includes('advertising'));
  assert.ok(!types.includes('website'));
});

test('needs: strong reviews but weak social → social media', () => {
  const needs = inferBusinessNeeds(biz({ website: 'https://x.co.uk', rating: 4.8, reviewCount: 300 }), inspection({ adSignals: ['google_ads'] }));
  assert.ok(needs.some((n) => n.type === 'social_media'));
  assert.ok(!needs.some((n) => n.type === 'advertising'));
});

// ---------------------------------------------------------- social + website

test('classifySocialUrl accepts profiles and rejects posts/share links', () => {
  assert.equal(classifySocialUrl('https://www.instagram.com/smile_co/')?.username, 'smile_co');
  assert.equal(classifySocialUrl('https://www.tiktok.com/@smile.co')?.platform, 'tiktok');
  assert.equal(classifySocialUrl('https://www.linkedin.com/company/smile-co')?.platform, 'linkedin');
  assert.equal(classifySocialUrl('https://www.instagram.com/p/Cxyz/'), null);
  assert.equal(classifySocialUrl('https://www.facebook.com/sharer/sharer.php?u=x'), null);
  assert.equal(classifySocialUrl('https://example.com/instagram'), null);
});

test('socials come from links/sameAs, conflicting equal-confidence links are dropped', () => {
  const html = `
    <script type="application/ld+json">{"@type":"Dentist","sameAs":["https://www.facebook.com/smileco"]}</script>
    <a href="https://www.instagram.com/smileco">IG</a>
    <a href="https://www.youtube.com/@a">a</a><a href="https://www.youtube.com/@b">b</a>`;
  const merged = mergeSocialEvidence(socialsFromHtml(html));
  const platforms = merged.map((e) => e.platform);
  assert.deepEqual(platforms, ['instagram', 'facebook']);
  assert.equal(merged.find((e) => e.platform === 'facebook')!.source, 'structured_data');
  assert.equal(socialsFromOsmTags({ 'contact:tiktok': '@smileco' })[0].url, 'https://www.tiktok.com/@smileco');
});

test('parseWebsiteHtml finds real mailto emails only, plus meta and ad tags', () => {
  const p = parseWebsiteHtml(
    `<html><head><title>Smile Co</title><meta name="viewport" content="width=device-width">
     <script src="https://www.googletagmanager.com/gtag/js?id=AW-123"></script></head>
     <body><a href="mailto:hello@smileco.co.uk">Email</a><a href="/contact">Contact</a><p>info at smileco</p></body></html>`,
    'https://smileco.co.uk/'
  );
  assert.equal(p.title, 'Smile Co');
  assert.deepEqual(p.emails, ['hello@smileco.co.uk']);
  assert.equal(p.hasViewportMeta, true);
  assert.equal(p.hasMetaDescription, false);
  assert.deepEqual(p.adSignals, ['google_ads']);
  assert.deepEqual(p.keyLinks, [{ label: 'Contact', url: 'https://smileco.co.uk/contact' }]);
});

test('isEmbeddable honours X-Frame-Options and CSP frame-ancestors', () => {
  const app = 'https://launchly.pazeruga.workers.dev';
  assert.equal(isEmbeddable(new Headers(), app), true);
  assert.equal(isEmbeddable(new Headers({ 'X-Frame-Options': 'DENY' }), app), false);
  assert.equal(isEmbeddable(new Headers({ 'X-Frame-Options': 'SAMEORIGIN' }), app), false);
  assert.equal(isEmbeddable(new Headers({ 'Content-Security-Policy': "frame-ancestors 'self'" }), app), false);
  assert.equal(isEmbeddable(new Headers({ 'Content-Security-Policy': "frame-ancestors 'none'" }), app), false);
  assert.equal(isEmbeddable(new Headers({ 'Content-Security-Policy': 'frame-ancestors *' }), app), true);
  assert.equal(isEmbeddable(new Headers({ 'Content-Security-Policy': "default-src 'self'" }), app), true);
});

// ---------------------------------------------------------- cache + rate limit

test('cache: second read is a hit and expires after TTL', async () => {
  let now = 0;
  const cache = new BusinessCache(null, () => now);
  let computes = 0;
  const fn = async () => ++computes;
  assert.deepEqual(await cache.wrap('k', 10, fn), { value: 1, cached: false });
  assert.deepEqual(await cache.wrap('k', 10, fn), { value: 1, cached: true });
  now = 11_000;
  assert.deepEqual(await cache.wrap('k', 10, fn), { value: 2, cached: false });
});

test('rate limiter blocks after the per-minute limit and resets next window', async () => {
  let now = 0;
  const rl = new RateLimiter(2, null, () => now);
  assert.equal(await rl.allow('u'), true);
  assert.equal(await rl.allow('u'), true);
  assert.equal(await rl.allow('u'), false);
  assert.equal(await rl.allow('other'), true);
  now = 61_000;
  assert.equal(await rl.allow('u'), true);
});

// ---------------------------------------------------------- HTTP handler

function makeDeps(over: Partial<BusinessApiDeps> = {}) {
  let searches = 0;
  const store = new MemoryBusinessStore();
  const found = [
    biz({ id: 'osm:node:1', name: 'Alpha Dental', website: 'https://alpha.co.uk' }),
    biz({ id: 'osm:node:2', name: 'Beta Dental' }),
  ];
  const provider = {
    name: 'osm' as const,
    async search() {
      searches++;
      return found;
    },
    async getById(id: string) {
      return found.find((b) => b.id === id) ?? null;
    },
  };
  const deps: BusinessApiDeps = {
    async getUserId(req) {
      const a = req.headers.get('Authorization');
      return a ? a.replace('Bearer ', '') : null;
    },
    searchProvider: () => provider,
    providerForId: () => provider,
    cache: new BusinessCache(),
    limiter: new RateLimiter(100),
    store,
    async inspectWebsite(url) {
      return inspection({
        url,
        embeddable: false,
        socials: [{ platform: 'tiktok', url: 'https://www.tiktok.com/@alphadental', username: 'alphadental', source: 'business_website', confidence: 0.95 }],
        emails: ['hello@alpha.co.uk'],
      });
    },
    async inspectProfilePage(url) {
      return { url, title: 'IG', description: null, image: null, embeddable: false };
    },
    async lookupTikTok(username) {
      return { username, displayName: 'Alpha', avatar: null, bio: null, followers: 10, following: 1, likes: 5, videos: [] };
    },
    emailStatus: () => ({ configured: false, provider: 'gmail' }),
    ...over,
  };
  return { deps, store, searches: () => searches };
}

const req = (path: string, user: string | null = 'user-a', init: RequestInit = {}) =>
  new Request(`https://w.example${path}`, { ...init, headers: { ...(user ? { Authorization: `Bearer ${user}` } : {}), 'Content-Type': 'application/json' } });

test('search: validates input', () => {
  assert.equal(parseSearchParams(new URL('https://x/?country=GB&city=Chelmsford&type=dentist')).ok, true);
  assert.equal(parseSearchParams(new URL('https://x/?country=GB&city=&type=dentist')).ok, false);
  assert.equal(parseSearchParams(new URL('https://x/?country=ZZ&city=A&type=dentist')).ok, false);
  assert.equal(parseSearchParams(new URL('https://x/?country=GB&city=Chelmsford&type=nope')).ok, false);
  assert.equal(parseSearchParams(new URL('https://x/?country=GB&city=Chelmsford')).ok, false);
});

test('search: requires auth, returns enriched results, caches repeats, hides provenance', async () => {
  const { deps, searches } = makeDeps();
  assert.equal((await handleBusinessRequest(req('/api/businesses/search?country=GB&city=Chelmsford&type=dentist', null), deps)).status, 401);

  const r1 = await handleBusinessRequest(req('/api/businesses/search?country=GB&city=Chelmsford&type=dentist'), deps);
  const j1: any = await r1.json();
  assert.equal(r1.status, 200);
  assert.equal(j1.data.length, 2);
  assert.equal(j1.cached, false);
  assert.ok(j1.data[0].budget.estimated);
  assert.ok(Array.isArray(j1.data[0].needs));
  assert.equal(j1.data[0].socialEvidence, undefined);

  const j2: any = await (await handleBusinessRequest(req('/api/businesses/search?country=GB&city=chelmsford&type=dentist'), deps)).json();
  assert.equal(j2.cached, true);
  assert.equal(searches(), 1);
});

test('search: rate limited requests get 429', async () => {
  const { deps } = makeDeps({ limiter: new RateLimiter(1) });
  await handleBusinessRequest(req('/api/businesses/search?country=GB&city=Chelmsford&type=dentist'), deps);
  assert.equal((await handleBusinessRequest(req('/api/businesses/search?country=GB&city=Chelmsford&type=dentist'), deps)).status, 429);
});

test('social: merges website socials and discovered email', async () => {
  const { deps } = makeDeps();
  const j: any = await (await handleBusinessRequest(req('/api/businesses/osm%3Anode%3A1/social'), deps)).json();
  assert.equal(j.data.socialProfiles.tiktok, 'https://www.tiktok.com/@alphadental');
  assert.equal(j.data.email, 'hello@alpha.co.uk');
  assert.equal(j.data.emailSource, 'business_website');
});

test('preview: website blocked from embedding is reported, TikTok shows only that profile', async () => {
  const { deps } = makeDeps();
  const w: any = await (await handleBusinessRequest(req('/api/businesses/osm%3Anode%3A1/preview?platform=website'), deps)).json();
  assert.equal(w.data.kind, 'website');
  assert.equal(w.data.embeddable, false);
  const t: any = await (await handleBusinessRequest(req('/api/businesses/osm%3Anode%3A1/preview?platform=tiktok'), deps)).json();
  assert.equal(t.data.kind, 'tiktok');
  assert.equal(t.data.profile.username, 'alphadental');
  const none = await handleBusinessRequest(req('/api/businesses/osm%3Anode%3A2/preview?platform=tiktok'), deps);
  assert.equal(none.status, 404);
  assert.equal(((await none.json()) as any).error.message, 'TikTok profile not found');
});

test('save + notes are isolated per user', async () => {
  const { deps } = makeDeps();
  const saved: any = await (await handleBusinessRequest(req('/api/businesses/osm%3Anode%3A1/save', 'user-a', { method: 'POST' }), deps)).json();
  assert.equal(saved.data.name, 'Alpha Dental');

  await handleBusinessRequest(req('/api/businesses/osm%3Anode%3A1/notes', 'user-a', { method: 'POST', body: JSON.stringify({ content: 'Call Monday' }) }), deps);
  const a: any = await (await handleBusinessRequest(req('/api/businesses/osm%3Anode%3A1/notes', 'user-a'), deps)).json();
  const b: any = await (await handleBusinessRequest(req('/api/businesses/osm%3Anode%3A1/notes', 'user-b'), deps)).json();
  assert.equal(a.data.length, 1);
  assert.equal(a.data[0].content, 'Call Monday');
  assert.equal(b.data.length, 0);

  const leadsB: any = await (await handleBusinessRequest(req('/api/businesses/saved', 'user-b'), deps)).json();
  assert.equal(leadsB.data.length, 0);
});

test('outreach: draft saves, send refuses without a connected mailbox', async () => {
  const { deps } = makeDeps();
  const d = await handleBusinessRequest(
    req('/api/businesses/osm%3Anode%3A1/outreach', 'user-a', { method: 'POST', body: JSON.stringify({ intent: 'draft', subject: 'Hi', body: 'Hello there' }) }),
    deps
  );
  assert.equal(((await d.json()) as any).data.status, 'draft');
  const s = await handleBusinessRequest(
    req('/api/businesses/osm%3Anode%3A1/outreach', 'user-a', { method: 'POST', body: JSON.stringify({ intent: 'send', subject: 'Hi', body: 'x' }) }),
    deps
  );
  assert.equal(s.status, 409);
  const st: any = await (await handleBusinessRequest(req('/api/email/status'), deps)).json();
  assert.equal(st.data.connected, false);
});

test('invalid business ids are rejected', async () => {
  const { deps } = makeDeps();
  assert.equal((await handleBusinessRequest(req('/api/businesses/..%2Fetc/social'), deps)).status, 400);
});
