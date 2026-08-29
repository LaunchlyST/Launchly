/**
 * The Stripe events this product actually cares about.
 *
 * Enable exactly these in the Stripe dashboard (Developers → Webhooks).
 * Subscribing to everything makes the handler noisy and hides real failures.
 */

export const STRIPE_WEBHOOK_EVENTS = {
  /** Checkout finished — the first payment succeeded. Create the record. */
  CHECKOUT_COMPLETED: 'checkout.session.completed',

  /** Plan change, cancel-at-period-end toggle, or status change. */
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',

  /** The subscription is gone for good. Drop to the fallback plan. */
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',

  /** A renewal was paid — extend the period. */
  INVOICE_PAID: 'invoice.paid',

  /** A renewal failed — mark past_due and prompt the user. */
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
} as const;

export type StripeWebhookEvent = (typeof STRIPE_WEBHOOK_EVENTS)[keyof typeof STRIPE_WEBHOOK_EVENTS];

/** The full list, for registering the endpoint. */
export const HANDLED_EVENTS: StripeWebhookEvent[] = Object.values(STRIPE_WEBHOOK_EVENTS);

/** True if an incoming event is one we handle. */
export function isHandledEvent(type: string): type is StripeWebhookEvent {
  return (HANDLED_EVENTS as string[]).includes(type);
}
