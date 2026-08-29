/**
 * ── THE ACCESS RULES ───────────────────────────────────────────────────────
 *
 * Pure functions: (plan + subscription status + usage) → what is allowed.
 * No Stripe, no fetch, no React. This is the whole reason the paywall can be
 * reasoned about and tested without touching the payment system.
 *
 * The one rule that matters: access follows the RECORDED subscription, and
 * that record is only ever written by the payment side. The paywall never
 * grants access on its own, and never takes money.
 */
import { FeatureKey, LimitKey, PlanId } from '../types/plan.types';
import { AccessDecision, AccessSnapshot, LimitState, UsageCounters } from '../types/access.types';
import { ALL_FEATURES, FALLBACK_PLAN_ID, FEATURE_LABELS } from '../config/plans';
import { cheapestPlanWithFeature, cheapestPlanWithHigherLimit, getPlan, planLimit } from '../plans/planRegistry';
import { Subscription } from '../../subscription/types/subscription.types';

/** Limits, in the order the UI lists them. */
const ALL_LIMITS: LimitKey[] = [
  'projects',
  'exportsPerMonth',
  'aiGenerationsPerMonth',
  'maxUploadMb',
  'maxTimelineMinutes',
];

/**
 * Is the subscription currently entitled to its paid plan?
 *
 * `active` and `trialing` obviously are. A cancelled subscription still is
 * until the paid period runs out — the user paid for that time. Everything
 * else falls back to Free.
 */
export function isSubscriptionActive(sub: Subscription, now: Date = new Date()): boolean {
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'canceled' && sub.currentPeriodEnd) {
    return new Date(sub.currentPeriodEnd).getTime() > now.getTime();
  }
  return false;
}

/**
 * The plan whose rules apply right now. A lapsed subscription drops to the
 * fallback plan no matter what `sub.planId` still says — so no cleanup job is
 * needed when a subscription expires.
 */
export function effectivePlanId(sub: Subscription, now?: Date): PlanId {
  return isSubscriptionActive(sub, now) ? sub.planId : FALLBACK_PLAN_ID;
}

function limitState(planId: PlanId, key: LimitKey, usage: UsageCounters): LimitState {
  const allowed = planLimit(planId, key);
  const used = usage[key] ?? 0;
  return {
    key,
    used,
    allowed,
    remaining: allowed === null ? null : Math.max(0, allowed - used),
    exhausted: allowed !== null && used >= allowed,
  };
}

/**
 * Resolves everything at once. Compute this when the subscription or usage
 * changes, then read it everywhere — components must not re-derive access.
 */
export function resolveAccess(sub: Subscription, usage: UsageCounters = {}, now?: Date): AccessSnapshot {
  const active = isSubscriptionActive(sub, now);
  const planId = effectivePlanId(sub, now);
  const plan = getPlan(planId);

  const features = {} as Record<FeatureKey, boolean>;
  for (const feature of ALL_FEATURES) features[feature] = plan.features.includes(feature);

  const limits = {} as Record<LimitKey, LimitState>;
  for (const key of ALL_LIMITS) limits[key] = limitState(planId, key, usage);

  return { planId, isActive: active, features, limits };
}

/** May the user use this feature? */
export function canUseFeature(snapshot: AccessSnapshot, feature: FeatureKey): AccessDecision {
  if (snapshot.features[feature]) return { allowed: true };

  const required = cheapestPlanWithFeature(feature) ?? undefined;
  const label = FEATURE_LABELS[feature];

  // "You never had this" and "you had it and it lapsed" deserve different
  // copy and a different call to action.
  if (!snapshot.isActive && required) {
    return {
      allowed: false,
      reason: 'subscription_inactive',
      requiredPlan: required,
      message: `${label} needs an active subscription.`,
    };
  }

  return {
    allowed: false,
    reason: 'plan_required',
    requiredPlan: required,
    message: required ? `${label} is included in ${getPlan(required).name}.` : `${label} is not available.`,
  };
}

/** Is there allowance left? `amount` is how much this action would consume. */
export function canConsume(snapshot: AccessSnapshot, key: LimitKey, amount = 1): AccessDecision {
  const state = snapshot.limits[key];
  if (!state || state.allowed === null) return { allowed: true };
  if (state.used + amount <= state.allowed) return { allowed: true };

  const required = cheapestPlanWithHigherLimit(key, snapshot.planId) ?? undefined;
  return {
    allowed: false,
    reason: 'limit_reached',
    requiredPlan: required,
    message: `You've used ${state.used} of ${state.allowed} on ${getPlan(snapshot.planId).name}.`,
  };
}
