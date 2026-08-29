/**
 * What the user's subscription IS right now.
 *
 * This record is the ONE handover point between the two systems: the payment
 * side writes it (from Stripe webhooks), the paywall reads it. Neither folder
 * reaches past it into the other.
 */
import { PlanId } from '../../paywall/types/plan.types';

/**
 * Mirrors Stripe's subscription statuses so nothing is lost in translation.
 * `none` is our own value for a user who has never subscribed.
 */
export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'incomplete'
  | 'canceled'
  | 'unpaid';

/**
 * Identifiers owned by Stripe. Never invented client-side — they arrive from
 * the backend, which learned them from Stripe.
 */
export interface StripeRefs {
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
}

export interface Subscription {
  /** Which plan the money bought. Falls back to 'free' when nothing is paid. */
  planId: PlanId;
  status: SubscriptionStatus;
  stripe: StripeRefs;
  /** ISO timestamp the current paid period ends. */
  currentPeriodEnd: string | null;
  /**
   * True when the user cancelled but the paid period has not run out. Access
   * continues until `currentPeriodEnd` — see the paywall's accessRules.
   */
  cancelAtPeriodEnd: boolean;
  /** Set when the last payment attempt failed, for the billing UI. */
  lastPaymentError: string | null;
  /** When this record was last confirmed against the backend. */
  refreshedAt: string | null;
}

/** The state a user starts in, and the state we fall back to on any failure. */
export const ANONYMOUS_SUBSCRIPTION: Subscription = {
  planId: 'free',
  status: 'none',
  stripe: { customerId: null, subscriptionId: null, priceId: null },
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  lastPaymentError: null,
  refreshedAt: null,
};
