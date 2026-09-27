import { WORKER_URL } from '../../lib/workerUrl';

/**
 * Frontend gateway to the worker's Business Connect routes. Every call is
 * authenticated with the signed-in user's Supabase access token; no
 * third-party key ever reaches the browser.
 */

export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'linkedin';
export type PreviewPlatform = 'website' | SocialPlatform;

export interface BusinessNeed {
  type: string;
  label: string;
  reason: string;
  confidence: number;
}

export interface Business {
  id: string;
  provider: 'osm' | 'google';
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  openingHours: string | null;
  photo: string | null;
  priceLevel: number | null;
  socialProfiles: Record<SocialPlatform, string | null>;
  budget: { min: number; max: number; currency: string; symbol: string; period: 'month'; estimated: true };
  needs: BusinessNeed[];
}

export interface SocialDetails {
  business: Business;
  socialProfiles: Record<SocialPlatform, string | null>;
  email: string | null;
  emailSource: 'provider' | 'business_website' | null;
  needs: BusinessNeed[];
}

export interface WebsitePreview {
  kind: 'website';
  url: string;
  domain: string | null;
  reachable: boolean;
  embeddable: boolean;
  title: string | null;
  description: string | null;
  favicon: string | null;
  image: string | null;
  keyLinks: { label: string; url: string }[];
}

export interface TikTokPreview {
  kind: 'tiktok';
  url: string;
  embeddable: false;
  profile: {
    username: string;
    displayName: string | null;
    avatar: string | null;
    bio: string | null;
    followers: number | null;
    following: number | null;
    likes: number | null;
    videos: { id: string | null; cover: string | null; description: string | null; views: number | null }[];
  } | null;
}

export interface ProfilePreview {
  kind: 'profile';
  platform: SocialPlatform;
  url: string;
  username: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  embeddable: boolean;
}

export type Preview = WebsitePreview | TikTokPreview | ProfilePreview;

export interface OutreachRecord {
  id: string;
  channel: 'email' | 'message' | 'follow_up';
  subject: string | null;
  body: string;
  status: 'draft' | 'scheduled' | 'sent' | 'replied' | 'failed';
  scheduledFor: string | null;
  createdAt: string;
}

export interface BusinessNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface SearchParams {
  q: string;
  country: string;
  city: string;
  type: string;
}

export class BusinessApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'BusinessApiError';
    this.code = code;
    this.status = status;
  }
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<{ data: T; meta: any }> {
  if (!WORKER_URL) throw new BusinessApiError('The Launchly backend is not configured (VITE_WORKER_URL).', 'NOT_CONFIGURED');
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
    });
  } catch {
    throw new BusinessApiError('Could not reach the Launchly backend.', 'NETWORK');
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok || body?.success === false) {
    throw new BusinessApiError(body?.error?.message || `Request failed (HTTP ${res.status}).`, body?.error?.code, res.status);
  }
  const { data, success: _s, ...meta } = body;
  return { data: data as T, meta };
}

const enc = encodeURIComponent;

export const businessApi = {
  search(p: SearchParams, token: string) {
    const qs = new URLSearchParams({ country: p.country, city: p.city, limit: '30' });
    if (p.type) qs.set('type', p.type);
    if (p.q.trim()) qs.set('q', p.q.trim());
    return call<Business[]>(`/api/businesses/search?${qs}`, token);
  },
  social(id: string, token: string) {
    return call<SocialDetails>(`/api/businesses/${enc(id)}/social`, token);
  },
  preview(id: string, platform: PreviewPlatform, token: string) {
    return call<Preview>(`/api/businesses/${enc(id)}/preview?platform=${platform}`, token);
  },
  save(id: string, token: string) {
    return call<{ id: string }>(`/api/businesses/${enc(id)}/save`, token, { method: 'POST' });
  },
  notes(id: string, token: string) {
    return call<BusinessNote[]>(`/api/businesses/${enc(id)}/notes`, token);
  },
  addNote(id: string, content: string, token: string) {
    return call<BusinessNote>(`/api/businesses/${enc(id)}/notes`, token, { method: 'POST', body: JSON.stringify({ content }) });
  },
  outreach(id: string, token: string) {
    return call<OutreachRecord[]>(`/api/businesses/${enc(id)}/outreach`, token);
  },
  addOutreach(
    id: string,
    payload: { intent: 'draft' | 'send' | 'follow_up'; channel?: 'email' | 'message'; subject?: string; body?: string; scheduledFor?: string },
    token: string
  ) {
    return call<OutreachRecord>(`/api/businesses/${enc(id)}/outreach`, token, { method: 'POST', body: JSON.stringify(payload) });
  },
  emailStatus(token: string) {
    return call<{ connected: boolean; provider: 'gmail'; configured: boolean; account: string | null }>(`/api/email/status`, token);
  },
};

/** Photo URLs from the worker's proxy are relative; make them absolute. */
export function photoUrl(photo: string | null): string | null {
  if (!photo) return null;
  return photo.startsWith('/') ? `${WORKER_URL}${photo}` : photo;
}

export const CATEGORIES: { id: string; label: string }[] = [
  { id: 'dentist', label: 'Dentists' },
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'cafe', label: 'Cafés' },
  { id: 'gym', label: 'Gyms' },
  { id: 'beauty', label: 'Beauty Salons' },
  { id: 'roofer', label: 'Roofers' },
  { id: 'estate_agent', label: 'Estate Agents' },
  { id: 'accountant', label: 'Accountants' },
  { id: 'car_dealer', label: 'Car Dealers' },
  { id: 'lawyer', label: 'Solicitors' },
  { id: 'plumber', label: 'Plumbers' },
  { id: 'electrician', label: 'Electricians' },
  { id: 'vet', label: 'Vets' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'retail', label: 'Retail' },
];

export const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'LT', name: 'Lithuania' },
];

/** A few well-known cities per country as quick picks; any city can be typed. */
export const CITY_SUGGESTIONS: Record<string, string[]> = {
  GB: ['Chelmsford', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Glasgow', 'Edinburgh', 'Liverpool', 'Colchester'],
  IE: ['Dublin', 'Cork', 'Galway', 'Limerick'],
  US: ['New York', 'Los Angeles', 'Chicago', 'Austin', 'Miami', 'Seattle'],
  DE: ['Berlin', 'Munich', 'Hamburg', 'Cologne'],
  FR: ['Paris', 'Lyon', 'Marseille', 'Bordeaux'],
  ES: ['Madrid', 'Barcelona', 'Valencia', 'Seville'],
  NL: ['Amsterdam', 'Rotterdam', 'Utrecht', 'The Hague'],
  LT: ['Vilnius', 'Kaunas', 'Klaipėda'],
};

export function formatBudget(b: Business['budget']): string {
  const f = (n: number) => (n >= 1000 ? `${b.symbol}${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : `${b.symbol}${n}`);
  return `${f(b.min)} – ${f(b.max)}`;
}

export function formatCount(n: number | null): string {
  if (n == null) return 'Unavailable';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
