/**
 * The business types Business Connect can search for, and how each maps to
 * OpenStreetMap tags (the default, free provider) and to a Google Places
 * text query (the optional, paid provider).
 *
 * `tier` drives the ad-budget estimator: it reflects how much businesses in
 * that industry typically spend on local advertising relative to each other
 * (high-ticket services spend more per lead than a café does).
 */

export interface BusinessCategory {
  id: string;
  label: string;
  /** Overpass tag filters, e.g. ['amenity=dentist']. Any one may match. */
  osm: string[];
  googleQuery: string;
  tier: 1 | 2 | 3 | 4;
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { id: 'dentist', label: 'Dentists', osm: ['amenity=dentist', 'healthcare=dentist'], googleQuery: 'dentist', tier: 4 },
  { id: 'restaurant', label: 'Restaurants', osm: ['amenity=restaurant'], googleQuery: 'restaurant', tier: 2 },
  { id: 'cafe', label: 'Cafés', osm: ['amenity=cafe'], googleQuery: 'cafe', tier: 1 },
  { id: 'gym', label: 'Gyms', osm: ['leisure=fitness_centre', 'leisure=sports_centre'], googleQuery: 'gym', tier: 2 },
  { id: 'beauty', label: 'Beauty Salons', osm: ['shop=beauty', 'shop=hairdresser'], googleQuery: 'beauty salon', tier: 2 },
  { id: 'roofer', label: 'Roofers', osm: ['craft=roofer'], googleQuery: 'roofer', tier: 3 },
  { id: 'estate_agent', label: 'Estate Agents', osm: ['office=estate_agent'], googleQuery: 'estate agent', tier: 3 },
  { id: 'accountant', label: 'Accountants', osm: ['office=accountant', 'office=tax_advisor'], googleQuery: 'accountant', tier: 3 },
  { id: 'car_dealer', label: 'Car Dealers', osm: ['shop=car'], googleQuery: 'car dealer', tier: 4 },
  { id: 'lawyer', label: 'Solicitors', osm: ['office=lawyer'], googleQuery: 'solicitor', tier: 4 },
  { id: 'plumber', label: 'Plumbers', osm: ['craft=plumber'], googleQuery: 'plumber', tier: 3 },
  { id: 'electrician', label: 'Electricians', osm: ['craft=electrician'], googleQuery: 'electrician', tier: 3 },
  { id: 'vet', label: 'Vets', osm: ['amenity=veterinary'], googleQuery: 'veterinary clinic', tier: 3 },
  { id: 'hotel', label: 'Hotels', osm: ['tourism=hotel', 'tourism=guest_house'], googleQuery: 'hotel', tier: 3 },
  { id: 'retail', label: 'Retail', osm: ['shop=clothes', 'shop=gift', 'shop=furniture'], googleQuery: 'shop', tier: 2 },
];

export function getCategory(id: string): BusinessCategory | null {
  return BUSINESS_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** Best-effort label for an OSM tag set, used to show "Dentist" on a card. */
export function categoryFromOsmTags(tags: Record<string, string>): BusinessCategory | null {
  for (const cat of BUSINESS_CATEGORIES) {
    for (const filter of cat.osm) {
      const [k, v] = filter.split('=');
      if (tags[k] === v) return cat;
    }
  }
  return null;
}

/** ISO 3166-1 alpha-2 countries offered in the UI, with their currency. */
export const COUNTRIES: { code: string; name: string; currency: 'GBP' | 'USD' | 'EUR' }[] = [
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR' },
];

export function countryCurrency(code: string | null): 'GBP' | 'USD' | 'EUR' {
  return COUNTRIES.find((c) => c.code === (code ?? '').toUpperCase())?.currency ?? 'GBP';
}
