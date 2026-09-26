import type { Business, BusinessSearchParams } from './businessTypes.ts';
import { categoryFromOsmTags, getCategory } from './businessCategories.ts';
import { evidenceToProfiles, mergeSocialEvidence, socialsFromOsmTags } from './socialDiscovery.ts';
import { fetchWithTimeout, normalizeWebsiteUrl, UpstreamError } from './httpUtil.ts';

/**
 * Business data providers. Every provider returns the same normalized
 * `Business` shape, and every field it cannot supply is `null`.
 *
 * - OpenStreetMapProvider (default, free, no key): Nominatim to find the city,
 *   Overpass to list businesses in it. Real, community-maintained data. OSM
 *   has no ratings, review counts or photos — those stay null.
 * - GooglePlacesProvider (used only when GOOGLE_PLACES_API_KEY is set):
 *   Places API (New) Text Search, which adds ratings, reviews and photos.
 */

export interface BusinessDataProvider {
  name: 'osm' | 'google';
  search(params: BusinessSearchParams): Promise<Business[]>;
  getById(id: string): Promise<Business | null>;
}

export class CityNotFoundError extends Error {}
export class InvalidBusinessIdError extends Error {}

type FetchLike = typeof fetch;

// ---------------------------------------------------------------- OSM ----

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function joinAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const parts = [street, tags['addr:city'], tags['addr:postcode']].filter((p) => p && p.trim());
  return parts.length ? parts.join(', ') : tags['addr:full'] ?? null;
}

/** Pure: one Overpass element → a normalized Business (or null if unnamed). */
export function normalizeOsmElement(el: OsmElement, fallbackCity: string | null, country: string | null): Business | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;
  const cat = categoryFromOsmTags(tags);
  const evidence = mergeSocialEvidence(socialsFromOsmTags(tags));
  const email = tags['contact:email'] ?? tags.email ?? null;
  return {
    id: `osm:${el.type}:${el.id}`,
    provider: 'osm',
    name,
    category: cat ? cat.label.replace(/s$/, '') : null,
    description: tags.description?.trim() || null,
    address: joinAddress(tags),
    city: tags['addr:city'] ?? fallbackCity,
    country: (tags['addr:country'] ?? country)?.toUpperCase() ?? null,
    latitude: el.lat ?? el.center?.lat ?? null,
    longitude: el.lon ?? el.center?.lon ?? null,
    rating: null,
    reviewCount: null,
    phone: tags['contact:phone'] ?? tags.phone ?? null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    website: normalizeWebsiteUrl(tags['contact:website'] ?? tags.website ?? tags.url),
    openingHours: tags.opening_hours ?? null,
    photo: null,
    priceLevel: null,
    socialProfiles: evidenceToProfiles(evidence),
    socialEvidence: evidence,
  };
}

function escapeOverpassRegex(s: string): string {
  return s.replace(/[\\^$.*+?()[\]{}|"]/g, '\\$&');
}

/** Pure: builds the Overpass QL for a bounding box + category + name filter. */
export function buildOverpassQuery(bbox: [number, number, number, number], typeId: string, q: string, limit: number): string {
  const [s, w, n, e] = bbox;
  const box = `(${s},${w},${n},${e})`;
  const nameFilter = q ? `["name"~"${escapeOverpassRegex(q)}",i]` : '["name"]';
  const cat = getCategory(typeId);
  const selectors = cat
    ? cat.osm.map((f) => {
        const [k, v] = f.split('=');
        return `nwr["${k}"="${v}"]${nameFilter}${box};`;
      })
    : [`nwr[~"^(amenity|shop|office|craft|leisure|healthcare|tourism)$"~"."]${nameFilter}${box};`];
  return `[out:json][timeout:20];(${selectors.join('')});out center tags ${Math.min(limit * 2, 200)};`;
}

export class OpenStreetMapProvider implements BusinessDataProvider {
  name = 'osm' as const;
  private readonly fetchImpl: FetchLike;
  constructor(fetchImpl: FetchLike = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async geocodeCity(city: string, country: string): Promise<{ bbox: [number, number, number, number]; name: string }> {
    const u = new URL(NOMINATIM);
    u.searchParams.set('city', city);
    u.searchParams.set('countrycodes', country.toLowerCase());
    u.searchParams.set('format', 'jsonv2');
    u.searchParams.set('limit', '1');
    const res = await fetchWithTimeout(u.toString(), {}, 7000, this.fetchImpl);
    if (!res.ok) throw new UpstreamError(`Nominatim HTTP ${res.status}`, res.status);
    const rows = (await res.json()) as { boundingbox?: string[]; name?: string }[];
    const row = rows[0];
    if (!row?.boundingbox) throw new CityNotFoundError(`City "${city}" not found`);
    const [s, n, w, e] = row.boundingbox.map(Number);
    return { bbox: [s, w, n, e], name: row.name ?? city };
  }

  async search(params: BusinessSearchParams): Promise<Business[]> {
    const { bbox, name } = await this.geocodeCity(params.city, params.country);
    const query = buildOverpassQuery(bbox, params.type, params.q, params.limit);
    const res = await fetchWithTimeout(
      OVERPASS,
      { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      22000,
      this.fetchImpl
    );
    if (!res.ok) throw new UpstreamError(`Overpass HTTP ${res.status}`, res.status);
    const body = (await res.json()) as { elements?: OsmElement[] };
    const seen = new Set<string>();
    const out: Business[] = [];
    for (const el of body.elements ?? []) {
      const b = normalizeOsmElement(el, name, params.country);
      if (!b) continue;
      const key = `${b.name.toLowerCase()}|${b.address ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(b);
    }
    // Businesses with more verifiable information first; otherwise alphabetical.
    const richness = (b: Business) => (b.website ? 2 : 0) + (b.phone ? 1 : 0) + b.socialEvidence.length;
    out.sort((a, b) => richness(b) - richness(a) || a.name.localeCompare(b.name));
    return out.slice(0, params.limit);
  }

  async getById(id: string): Promise<Business | null> {
    const m = id.match(/^osm:(node|way|relation):(\d+)$/);
    if (!m) throw new InvalidBusinessIdError(id);
    const query = `[out:json][timeout:15];${m[1]}(${m[2]});out center tags;`;
    const res = await fetchWithTimeout(
      OVERPASS,
      { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      15000,
      this.fetchImpl
    );
    if (!res.ok) throw new UpstreamError(`Overpass HTTP ${res.status}`, res.status);
    const body = (await res.json()) as { elements?: OsmElement[] };
    const el = body.elements?.[0];
    return el ? normalizeOsmElement(el, null, null) : null;
  }
}

// ------------------------------------------------------------- Google ----

const PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'addressComponents', 'location', 'rating', 'userRatingCount',
  'nationalPhoneNumber', 'websiteUri', 'regularOpeningHours', 'photos', 'priceLevel', 'primaryTypeDisplayName',
  'editorialSummary',
];

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** Pure: one Places API (New) place → a normalized Business. */
export function normalizeGooglePlace(p: any): Business | null {
  const name = p?.displayName?.text?.trim();
  if (!p?.id || !name) return null;
  const comp = (type: string, short = false) => {
    const c = (p.addressComponents ?? []).find((a: any) => a.types?.includes(type));
    return c ? (short ? c.shortText : c.longText) ?? null : null;
  };
  const photoName = p.photos?.[0]?.name;
  return {
    id: `google:${p.id}`,
    provider: 'google',
    name,
    category: p.primaryTypeDisplayName?.text ?? null,
    description: p.editorialSummary?.text ?? null,
    address: p.formattedAddress ?? null,
    city: comp('postal_town') ?? comp('locality'),
    country: comp('country', true),
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    phone: p.nationalPhoneNumber ?? null,
    email: null,
    website: normalizeWebsiteUrl(p.websiteUri),
    openingHours: p.regularOpeningHours?.weekdayDescriptions?.join('; ') ?? null,
    // Proxied through the worker so the API key never reaches the browser.
    photo: photoName ? `/api/businesses/photo?name=${encodeURIComponent(photoName)}` : null,
    priceLevel: PRICE_LEVELS[p.priceLevel] ?? null,
    socialProfiles: { instagram: null, facebook: null, youtube: null, tiktok: null, linkedin: null },
    socialEvidence: [],
  };
}

export class GooglePlacesProvider implements BusinessDataProvider {
  name = 'google' as const;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  constructor(apiKey: string, fetchImpl: FetchLike = fetch) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async search(params: BusinessSearchParams): Promise<Business[]> {
    const cat = getCategory(params.type);
    const what = [params.q, cat?.googleQuery].filter(Boolean).join(' ') || 'business';
    const res = await fetchWithTimeout(
      PLACES_SEARCH,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': PLACES_FIELDS.map((f) => `places.${f}`).join(','),
        },
        body: JSON.stringify({
          textQuery: `${what} in ${params.city}`,
          regionCode: params.country,
          pageSize: Math.min(params.limit, 20),
        }),
      },
      10000,
      this.fetchImpl
    );
    if (!res.ok) throw new UpstreamError(`Places HTTP ${res.status}`, res.status);
    const body = (await res.json()) as { places?: any[] };
    return (body.places ?? []).map(normalizeGooglePlace).filter((b): b is Business => b !== null);
  }

  async getById(id: string): Promise<Business | null> {
    const m = id.match(/^google:([A-Za-z0-9_\-]+)$/);
    if (!m) throw new InvalidBusinessIdError(id);
    const res = await fetchWithTimeout(
      `https://places.googleapis.com/v1/places/${m[1]}`,
      { headers: { 'X-Goog-Api-Key': this.apiKey, 'X-Goog-FieldMask': PLACES_FIELDS.join(',') } },
      10000,
      this.fetchImpl
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new UpstreamError(`Places HTTP ${res.status}`, res.status);
    return normalizeGooglePlace(await res.json());
  }
}

export function getBusinessProvider(env: { GOOGLE_PLACES_API_KEY?: string }, fetchImpl: FetchLike = fetch): BusinessDataProvider {
  return env.GOOGLE_PLACES_API_KEY
    ? new GooglePlacesProvider(env.GOOGLE_PLACES_API_KEY, fetchImpl)
    : new OpenStreetMapProvider(fetchImpl);
}

export function providerForId(id: string, env: { GOOGLE_PLACES_API_KEY?: string }, fetchImpl: FetchLike = fetch): BusinessDataProvider {
  if (id.startsWith('osm:')) return new OpenStreetMapProvider(fetchImpl);
  if (id.startsWith('google:') && env.GOOGLE_PLACES_API_KEY) return new GooglePlacesProvider(env.GOOGLE_PLACES_API_KEY, fetchImpl);
  throw new InvalidBusinessIdError(id);
}
