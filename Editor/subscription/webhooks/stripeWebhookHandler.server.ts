/**
 * ⚠️ SERVER-SIDE ONLY — never import this from the React app.
 *
 * The `.server.ts` suffix marks the boundary: it needs the Stripe SECRET key
 * and the raw request body, neither of which exist in a browser. Move it into
 * your backend (Express route / serverless function) when you build one.
 *
 * This is the moment money becomes access: Stripe confirms the payment here,
 * we write the subscription record, and the paywall picks up the new plan on
 * its next read. The handler grants nothing — it only records facts.
 */
import { PlanId } from '../../paywall/types/plan.types';
import { PLANS, FALLBACK_PLAN_ID } from '../../paywall/config/plans';
import { Subscription } from '../types/subscription.types';
import { STRIPE_WEBHOOK_EVENTS, isHandledEvent } from './webhookEvents';
import { toSubscriptionStatus } from '../payments/paymentStatus';

/** Minimal shape of a Stripe event — swap for Stripe.Event in the backend. */
interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, any> };
}

/** What your persistence layer must provide. Implement against your database. */
export interface SubscriptionStore {
  findUserIdByCustomerId(customerId: string): Promise<string | null>;
  saveSubscription(userId: string, subscription: Subscription): Promise<void>;
  /** Stripe retries webhooks — skip an event id already applied. */
  hasProcessedEvent(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string): Promise<void>;
}

/** Resolves a Stripe Price ID back to one of our plans. */
export function planIdForPrice(priceId: string | null | undefined): PlanId {
  if (!priceId) return FALLBACK_PLAN_ID;
  const match = Object.values(PLANS).find((p) => p.stripePriceId === priceId);
  return match ? match.id : FALLBACK_PLAN_ID;
}

/** Builds our subscription record from a Stripe subscription object. */
function toSubscriptionRecord(sub: Record<string, any>): Subscription {
  const priceId: string | null = sub.items?.data?.[0]?.price?.id ?? null;
  return {
    planId: planIdForPrice(priceId),
    status: toSubscriptionStatus(sub.status),
    stripe: {
      customerId: typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null),
      subscriptionId: sub.id ?? null,
      priceId,
    },
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    lastPaymentError: null,
    refreshedAt: new Date().toISOString(),
  };
}

/**
 * Applies one verified Stripe event.
 *
 * IMPORTANT: verify the signature BEFORE calling this, using the raw request
 * body and your webhook signing secret:
 *
 *   const event = stripe.webhooks.constructEvent(rawBody, sigHeader, whSecret);
 *   await handleStripeEvent(event, store);
 *
 * Parsing the body first (e.g. express.json()) breaks verification.
 */
export async function handleStripeEvent(event: StripeEventLike, store: SubscriptionStore): Promise<void> {
  if (!isHandledEvent(event.type)) return;
  // Stripe delivers at-least-once, so every handler must be idempotent.
  if (await store.hasProcessedEvent(event.id)) return;

  const object = event.data.object;
  const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
  const userId = customerId ? await store.findUserIdByCustomerId(customerId) : null;
  if (!userId) return;

  switch (event.type) {
    case STRIPE_WEBHOOK_EVENTS.CHECKOUT_COMPLETED:
    case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED:
    case STRIPE_WEBHOOK_EVENTS.INVOICE_PAID: {
      // For invoice events the subscription sits one level down.
      const sub =
        object.subscription && typeof object.subscription === 'object' ? object.subscription : object;
      await store.saveSubscription(userId, toSubscriptionRecord(sub));
      break;
    }

    case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED: {
      const sub =
        object.subscription && typeof object.subscription === 'object' ? object.subscription : object;
      const record = toSubscriptionRecord(sub);
      await store.saveSubscription(userId, {
        ...record,
        status: 'past_due',
        lastPaymentError: object.last_payment_error?.message ?? 'The last payment attempt failed.',
      });
      break;
    }

    case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED: {
      // Over: drop to the fallback plan. Access follows automatically because
      // the paywall reads planId + status.
      await store.saveSubscription(userId, {
        ...toSubscriptionRecord(object),
        planId: FALLBACK_PLAN_ID,
        status: 'canceled',
      });
      break;
    }
  }

  await store.markEventProcessed(event.id);
}
