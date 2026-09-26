import type { AdBudgetEstimate, AdBudgetFactor, Business } from './businessTypes.ts';
import { BUSINESS_CATEGORIES, countryCurrency } from './businessCategories.ts';

/**
 * Rules-based *estimate* of a sensible monthly local-ad budget for a
 * business. We cannot know what anyone actually spends without access to
 * their ad accounts, so this is always labelled "Estimated ad budget" and
 * every multiplier that moved it is returned in `factors`.
 *
 * Deterministic: same inputs → same output. No AI calls.
 */

/** Base monthly range per industry tier, in GBP. */
const TIER_BASE: Record<1 | 2 | 3 | 4, [number, number]> = {
  1: [250, 750],
  2: [500, 1500],
  3: [750, 2500],
  4: [1000, 3500],
};

/** Rough GBP → local currency, rounded; budgets are ranges, not quotes. */
const FX: Record<'GBP' | 'USD' | 'EUR', number> = { GBP: 1, USD: 1.25, EUR: 1.15 };
const SYMBOL: Record<'GBP' | 'USD' | 'EUR', string> = { GBP: '£', USD: '$', EUR: '€' };

function tierFor(category: string | null): 1 | 2 | 3 | 4 {
  if (!category) return 2;
  const c = category.toLowerCase();
  const hit = BUSINESS_CATEGORIES.find(
    (cat) => cat.label.toLowerCase().replace(/s$/, '') === c.replace(/s$/, '') || c.includes(cat.googleQuery)
  );
  return hit?.tier ?? 2;
}

function roundTo(n: number, step: number) {
  return Math.max(step, Math.round(n / step) * step);
}

export interface BudgetContext {
  /** How many same-category businesses the search found in this city. */
  localCompetitors?: number;
}

export function estimateAdBudget(business: Business, ctx: BudgetContext = {}): AdBudgetEstimate {
  const tier = tierFor(business.category);
  let [min, max] = TIER_BASE[tier];
  const factors: AdBudgetFactor[] = [];
  const apply = (label: string, effect: number) => {
    min *= effect;
    max *= effect;
    factors.push({ label, effect });
  };

  factors.push({ label: `Industry tier ${tier}`, effect: 1 });

  if (business.reviewCount != null) {
    if (business.reviewCount >= 500) apply('Large customer base (500+ reviews)', 1.5);
    else if (business.reviewCount >= 150) apply('Established (150+ reviews)', 1.25);
    else if (business.reviewCount < 20) apply('Small footprint (<20 reviews)', 0.7);
  }

  if (business.priceLevel != null && business.priceLevel >= 3) apply('Premium price level', 1.2);

  if (!business.website) apply('No website to send ad traffic to', 0.75);

  const socialCount = business.socialEvidence.length;
  if (socialCount >= 3) apply('Active on 3+ social platforms', 1.15);

  if (ctx.localCompetitors != null) {
    if (ctx.localCompetitors >= 30) apply('High local competition', 1.2);
    else if (ctx.localCompetitors <= 5) apply('Low local competition', 0.85);
  }

  const currency = countryCurrency(business.country);
  const fx = FX[currency];
  const step = max * fx >= 2000 ? 500 : 50;
  const outMin = roundTo(min * fx, step);
  let outMax = roundTo(max * fx, step);
  if (outMax <= outMin) outMax = outMin + step;

  return { min: outMin, max: outMax, currency, symbol: SYMBOL[currency], period: 'month', estimated: true, factors };
}

export function formatBudget(b: AdBudgetEstimate): string {
  const f = (n: number) => (n >= 1000 ? `${b.symbol}${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : `${b.symbol}${n}`);
  return `${f(b.min)} – ${f(b.max)}`;
}
