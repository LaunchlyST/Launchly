/**
 * Business Connect — the normalized shapes every provider is mapped into.
 *
 * Rule for every field: if the provider did not give it to us, or we could
 * not verify it, it is `null`. Nothing here is ever filled in with a guess.
 */

export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'linkedin';

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'youtube', 'tiktok', 'linkedin'];

export type SocialSource = 'provider' | 'business_website' | 'structured_data';

/** A social profile with where it came from and how sure we are of it. */
export interface SocialProfileEvidence {
  platform: SocialPlatform;
  url: string;
  username: string | null;
  source: SocialSource;
  /** 0–1. Only profiles at or above SOCIAL_MIN_CONFIDENCE are ever shown. */
  confidence: number;
}

export const SOCIAL_MIN_CONFIDENCE = 0.8;

export type SocialProfiles = Record<SocialPlatform, string | null>;

export interface Business {
  /** Provider-scoped id, e.g. "osm:node:123456" or "google:ChIJ…". */
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
  /** 1–4 when the provider reports it, otherwise null. */
  priceLevel: number | null;
  socialProfiles: SocialProfiles;
  /** Internal provenance for socialProfiles. */
  socialEvidence: SocialProfileEvidence[];
}

export interface AdBudgetFactor {
  label: string;
  /** Multiplier applied to the base range, e.g. 1.2. */
  effect: number;
}

export interface AdBudgetEstimate {
  min: number;
  max: number;
  currency: 'GBP' | 'USD' | 'EUR';
  symbol: string;
  period: 'month';
  /** Always true: this is a rules-based estimate, never actual spend. */
  estimated: true;
  factors: AdBudgetFactor[];
}

export type NeedType =
  | 'website'
  | 'website_improvement'
  | 'social_media'
  | 'review_growth'
  | 'advertising'
  | 'google_ads'
  | 'lead_generation'
  | 'more_bookings';

export interface BusinessNeed {
  type: NeedType;
  label: string;
  reason: string;
  confidence: number;
}

/** What we learned from fetching a business's own website, if it has one. */
export interface WebsiteInspection {
  url: string;
  finalUrl: string;
  domain: string;
  ok: boolean;
  title: string | null;
  description: string | null;
  favicon: string | null;
  image: string | null;
  hasViewportMeta: boolean;
  hasMetaDescription: boolean;
  /** Google Ads / Meta Pixel / GTM tags found in the page. */
  adSignals: string[];
  /** Emails found as mailto: links or in structured data — never guessed. */
  emails: string[];
  socials: SocialProfileEvidence[];
  keyLinks: { label: string; url: string }[];
  /** False when X-Frame-Options / CSP frame-ancestors forbid embedding. */
  embeddable: boolean;
}

export interface EnrichedBusiness extends Business {
  budget: AdBudgetEstimate;
  needs: BusinessNeed[];
}

export interface BusinessSearchParams {
  q: string;
  country: string;
  city: string;
  type: string;
  limit: number;
}
