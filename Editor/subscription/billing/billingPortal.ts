/**
 * Managing an existing subscription — payment method, invoices, cancelling,
 * switching plan. Stripe's hosted billing portal handles all of it, so this
 * app never builds a card form or a cancellation flow of its own.
 *
 * Cancelling here does NOT immediately revoke access: Stripe sets
 * `cancel_at_period_end`, the webhook records it, and the paywall's rules
 * keep the user on their plan until the period they paid for actually ends.
 */
import { STRIPE_CONFIG } from '../config/stripeConfig';
import { postToBilling, redirectToStripe } from '../stripe/stripeClient';

interface PortalSessionResponse {
  portalUrl: string;
}

/** Sends the user to Stripe's billing portal; returns only on failure. */
export async function openBillingPortal(): Promise<void> {
  const { portalUrl } = await postToBilling<PortalSessionResponse>(
    STRIPE_CONFIG.endpoints.createPortalSession,
    { returnUrl: window.location.href }
  );
  redirectToStripe(portalUrl);
}
