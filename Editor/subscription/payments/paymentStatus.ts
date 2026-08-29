/**
 * Reading a payment state. Translates Stripe's vocabulary into ours and
 * answers what the billing UI asks — "did the money arrive?", "is this
 * recoverable?". It does not decide what the user may access; the paywall
 * does that, reading the status produced here.
 */
import { SubscriptionStatus } from '../types/subscription.types';

/** Stripe's `subscription.status` values, verbatim. */
const STRIPE_STATUSES: SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'incomplete',
  'canceled',
  'unpaid',
];

/** Maps a raw Stripe status onto ours, defaulting safely to `none`. */
export function toSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus {
  if (!raw) return 'none';
  return STRIPE_STATUSES.find((s) => s === raw) ?? 'none';
}

/** The money arrived and the subscription is current. */
export function isPaid(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing';
}

/**
 * Payment failed but Stripe is still retrying — the user has not lost the
 * subscription yet, so the billing UI should nudge rather than revoke.
 */
export function isRecoverable(status: SubscriptionStatus): boolean {
  return status === 'past_due' || status === 'incomplete';
}

/** Over — no more retries are coming. */
export function isTerminated(status: SubscriptionStatus): boolean {
  return status === 'canceled' || status === 'unpaid';
}

/** Copy for the billing panel. */
export function describeStatus(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trial';
    case 'past_due':
      return 'Payment failed — retrying';
    case 'incomplete':
      return 'Awaiting payment confirmation';
    case 'canceled':
      return 'Cancelled';
    case 'unpaid':
      return 'Unpaid';
    case 'none':
    default:
      return 'No subscription';
  }
}

/** Formats a plan price for display. Stripe remains the source of truth. */
export function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Free';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
