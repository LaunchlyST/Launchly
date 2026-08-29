/**
 * What the paywall ANSWERS. Access decisions only — no prices, no Stripe
 * objects. The UI renders these; it never re-derives access itself.
 */
import { FeatureKey, LimitKey, PlanId } from './plan.types';

/** Why something is locked. Drives the copy in the paywall modal. */
export type LockReason =
  | 'plan_required' // the plan simply does not include it
  | 'limit_reached' // included, but the allowance is spent
  | 'subscription_inactive'; // paid for once, but the subscription lapsed

export interface AccessDecision {
  allowed: boolean;
  /** Only set when `allowed` is false. */
  reason?: LockReason;
  /** The cheapest plan that would allow this, for the upgrade prompt. */
  requiredPlan?: PlanId;
  /** Human-readable explanation, safe to show directly in the UI. */
  message?: string;
}

export interface LimitState {
  key: LimitKey;
  used: number;
  /** `null` means unlimited on the current plan. */
  allowed: number | null;
  remaining: number | null;
  exhausted: boolean;
}

/**
 * The resolved picture of what this user can do right now: computed once from
 * (plan + subscription status + usage), then read everywhere.
 */
export interface AccessSnapshot {
  planId: PlanId;
  /** False when the subscription lapsed — paid features fall back to Free. */
  isActive: boolean;
  features: Record<FeatureKey, boolean>;
  limits: Record<LimitKey, LimitState>;
}

/** Counters the app keeps against the current billing period. */
export type UsageCounters = Partial<Record<LimitKey, number>>;
