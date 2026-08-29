/**
 * Looking plans up and comparing them. Pure reads over config/plans.ts — no
 * payments, no user state. Anything that needs "which plan is bigger" or
 * "which plan would unlock this" asks here.
 */
import { FeatureKey, LimitKey, PlanDefinition, PlanId } from '../types/plan.types';
import { FALLBACK_PLAN_ID, PLANS, PLAN_ORDER } from '../config/plans';

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId] ?? PLANS[FALLBACK_PLAN_ID];
}

/** Every plan, in pricing-page order. */
export function listPlans(): PlanDefinition[] {
  return PLAN_ORDER.map((id) => PLANS[id]);
}

export function planIncludesFeature(planId: PlanId, feature: FeatureKey): boolean {
  return getPlan(planId).features.includes(feature);
}

/** `null` = unlimited on this plan. */
export function planLimit(planId: PlanId, key: LimitKey): number | null {
  return getPlan(planId).limits[key];
}

/** Plans cheapest-first, for "what is the smallest upgrade that works?". */
function byRank(): PlanDefinition[] {
  return listPlans().slice().sort((a, b) => a.rank - b.rank);
}

/**
 * The cheapest plan that includes `feature` — the one to offer in an upgrade
 * prompt. Null if no plan has it (a feature not yet on sale).
 */
export function cheapestPlanWithFeature(feature: FeatureKey): PlanId | null {
  return byRank().find((p) => p.features.includes(feature))?.id ?? null;
}

/** The cheapest plan whose allowance for `key` beats the current plan's. */
export function cheapestPlanWithHigherLimit(key: LimitKey, current: PlanId): PlanId | null {
  const currentLimit = planLimit(current, key);
  if (currentLimit === null) return null; // already unlimited
  return (
    byRank().find((p) => {
      const limit = p.limits[key];
      return limit === null || limit > currentLimit;
    })?.id ?? null
  );
}

/** > 0 if `a` is the bigger plan, < 0 if smaller, 0 if the same. */
export function comparePlans(a: PlanId, b: PlanId): number {
  return getPlan(a).rank - getPlan(b).rank;
}

export function isUpgrade(from: PlanId, to: PlanId): boolean {
  return comparePlans(to, from) > 0;
}

export function isDowngrade(from: PlanId, to: PlanId): boolean {
  return comparePlans(to, from) < 0;
}

/**
 * What a user loses by moving to `to`. Shown before confirming a downgrade so
 * the change is never a surprise.
 */
export function featuresLostByChanging(from: PlanId, to: PlanId): FeatureKey[] {
  const next = getPlan(to).features;
  return getPlan(from).features.filter((f) => !next.includes(f));
}
