/**
 * Reading the user's subscription record from the backend.
 *
 * The handover point: the payment system writes this record via webhooks, the
 * paywall reads it. Nothing here decides access, and nothing here charges.
 */
import { PlanId } from '../../paywall/types/plan.types';
import { PLANS, FALLBACK_PLAN_ID } from '../../paywall/config/plans';
import { Subscription, ANONYMOUS_SUBSCRIPTION } from '../types/subscription.types';
import { STRIPE_CONFIG } from '../config/stripeConfig';
import { getFromBilling } from '../stripe/stripeClient';
import { toSubscriptionStatus } from '../payments/paymentStatus';

/** Trusts the backend's planId, but never a value we don't recognise. */
function safePlanId(raw: unknown): PlanId {
  return typeof raw === 'string' && raw in PLANS ? (raw as PlanId) : FALLBACK_PLAN_ID;
}

/** Normalises whatever the backend returns into our record shape. */
export function parseSubscription(raw: any): Subscription {
  if (!raw || typeof raw !== 'object') return ANONYMOUS_SUBSCRIPTION;
  return {
    planId: safePlanId(raw.planId),
    status: toSubscriptionStatus(raw.status),
    stripe: {
      customerId: raw.stripe?.customerId ?? null,
      subscriptionId: raw.stripe?.subscriptionId ?? null,
      priceId: raw.stripe?.priceId ?? null,
    },
    currentPeriodEnd: raw.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: !!raw.cancelAtPeriodEnd,
    lastPaymentError: raw.lastPaymentError ?? null,
    refreshedAt: new Date().toISOString(),
  };
}

/**
 * Fetches the current subscription. Falls back to the anonymous (Free) record
 * on any failure — a billing outage must never hand out paid access, and must
 * never lock a user out of the free tier either.
 */
export async function fetchSubscription(): Promise<Subscription> {
  try {
    const raw = await getFromBilling<unknown>(STRIPE_CONFIG.endpoints.subscription);
    return parseSubscription(raw);
  } catch {
    return ANONYMOUS_SUBSCRIPTION;
  }
}
