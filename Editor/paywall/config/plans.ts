/**
 * ── THE ONE PLACE PLANS ARE DEFINED ────────────────────────────────────────
 *
 * Change a plan here and it changes everywhere: pricing page, plan cards,
 * feature gates, limit checks and upgrade prompts all read from this file.
 * Never hard-code a feature or a limit anywhere else in the app.
 *
 * Adding a plan:
 *   1. add its id to PlanId in ../types/plan.types.ts
 *   2. add an entry below with a `rank` between its neighbours
 *   3. paste its Stripe Price ID into `stripePriceId`
 * Nothing else needs to change.
 */
import { FeatureKey, PlanDefinition, PlanId } from '../types/plan.types';

/** Every feature in the product. A plan's `features` list is a subset. */
export const ALL_FEATURES: FeatureKey[] = [
  'export.watermarkFree',
  'export.4k',
  'ai.generate',
  'ai.premiumModels',
  'timeline.extendedRange',
  'project.cloudSync',
  'media.unlimitedStorage',
];

/** Copy shown when a locked feature is hit. Keyed so it stays consistent. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  'export.watermarkFree': 'Watermark-free export',
  'export.4k': '4K export',
  'ai.generate': 'AI generation',
  'ai.premiumModels': 'Premium AI models',
  'timeline.extendedRange': 'Extended timeline range',
  'project.cloudSync': 'Cloud project sync',
  'media.unlimitedStorage': 'Unlimited media storage',
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Everything you need to try Launchly.',
    priceMonthlyCents: 0,
    currency: 'usd',
    rank: 0,
    features: [],
    limits: {
      projects: 2,
      exportsPerMonth: 3,
      aiGenerationsPerMonth: 10,
      maxUploadMb: 200,
      maxTimelineMinutes: 10,
    },
    stripePriceId: null,
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For creators publishing every week.',
    priceMonthlyCents: 1900,
    currency: 'usd',
    rank: 10,
    features: ['export.watermarkFree', 'ai.generate', 'timeline.extendedRange', 'project.cloudSync'],
    limits: {
      projects: 50,
      exportsPerMonth: 100,
      aiGenerationsPerMonth: 500,
      maxUploadMb: 2000,
      maxTimelineMinutes: 120,
    },
    // TODO: replace with the real Price ID from the Stripe dashboard.
    stripePriceId: 'price_REPLACE_ME_PRO_MONTHLY',
    recommended: true,
  },

  studio: {
    id: 'studio',
    name: 'Studio',
    tagline: 'Unlimited everything, for teams and heavy use.',
    priceMonthlyCents: 4900,
    currency: 'usd',
    rank: 20,
    features: ALL_FEATURES,
    limits: {
      projects: null,
      exportsPerMonth: null,
      aiGenerationsPerMonth: null,
      maxUploadMb: 10000,
      maxTimelineMinutes: null,
    },
    // TODO: replace with the real Price ID from the Stripe dashboard.
    stripePriceId: 'price_REPLACE_ME_STUDIO_MONTHLY',
  },
};

/** The plan an unpaid or lapsed user falls back to. */
export const FALLBACK_PLAN_ID: PlanId = 'free';

/** Pricing-page order. */
export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'studio'];
