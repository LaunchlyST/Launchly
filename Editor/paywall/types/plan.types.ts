/**
 * What a plan IS: a named bundle of features and limits.
 *
 * Nothing here knows about money. The Stripe Price ID on a plan is the single
 * bridge to the payment side, and it is only ever read by the subscription
 * folder — never used to make an access decision.
 */

/** Every plan the product offers. Add new plans here first. */
export type PlanId = 'free' | 'pro' | 'studio';

/**
 * Every gateable capability. A feature is either in a plan's `features` list
 * or it is locked — there is no third state.
 */
export type FeatureKey =
  | 'export.watermarkFree'
  | 'export.4k'
  | 'ai.generate'
  | 'ai.premiumModels'
  | 'timeline.extendedRange'
  | 'project.cloudSync'
  | 'media.unlimitedStorage';

/** Every countable allowance. `null` in a plan means unlimited. */
export type LimitKey =
  | 'projects'
  | 'exportsPerMonth'
  | 'aiGenerationsPerMonth'
  | 'maxUploadMb'
  | 'maxTimelineMinutes';

/** A per-plan allowance table. `null` = unlimited. */
export type PlanLimits = Record<LimitKey, number | null>;

export interface PlanDefinition {
  id: PlanId;
  /** Shown on plan cards and the current-plan panel. */
  name: string;
  /** One line under the plan name on the pricing page. */
  tagline: string;
  /**
   * Display price in minor units (cents), for the UI only. Stripe remains the
   * authority on what is actually charged.
   */
  priceMonthlyCents: number;
  currency: string;
  /**
   * Ranking for upgrade/downgrade comparisons. Higher = more capable. Keep
   * these spaced so a plan can be slotted between two later.
   */
  rank: number;
  /** Capabilities this plan unlocks. Anything absent is locked. */
  features: FeatureKey[];
  /** Allowances for this plan. */
  limits: PlanLimits;
  /**
   * The Stripe Price this plan maps to; `null` for a plan that is never
   * purchased (Free). Read only by the subscription folder.
   */
  stripePriceId: string | null;
  /** Highlights the plan on the pricing page. */
  recommended?: boolean;
}
