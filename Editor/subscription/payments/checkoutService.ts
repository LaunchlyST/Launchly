/**
 * Taking money for a plan.
 *
 * This module knows about prices and checkout; it knows nothing about which
 * features a plan unlocks. It reads the plan's Stripe Price ID — the single
 * value that crosses from the paywall's plan config into the money side.
 *
 * Flow: user picks a plan → look up its Price ID → backend creates a Checkout
 * Session → browser redirects to Stripe → Stripe collects payment → Stripe
 * fires a webhook → the subscription record updates → the paywall follows.
 */
import { PlanId } from '../../paywall/types/plan.types';
import { PLANS } from '../../paywall/config/plans';
import { STRIPE_CONFIG, isStripeConfigured } from '../config/stripeConfig';
import { StripeRequestError, postToBilling, redirectToStripe } from '../stripe/stripeClient';

interface CheckoutSessionResponse {
  checkoutUrl: string;
}

/**
 * Starts a paid subscription for `planId`. Returns only if the redirect
 * fails — on success the browser has already navigated to Stripe.
 */
export async function startCheckout(planId: PlanId): Promise<void> {
  const plan = PLANS[planId];

  if (!plan.stripePriceId) {
    throw new StripeRequestError(`${plan.name} is not a purchasable plan.`);
  }
  if (!isStripeConfigured()) {
    throw new StripeRequestError('Stripe is not configured yet. Add VITE_STRIPE_PUBLISHABLE_KEY.');
  }

  const { checkoutUrl } = await postToBilling<CheckoutSessionResponse>(
    STRIPE_CONFIG.endpoints.createCheckoutSession,
    {
      priceId: plan.stripePriceId,
      successUrl: STRIPE_CONFIG.returnUrls.success,
      cancelUrl: STRIPE_CONFIG.returnUrls.cancel,
    }
  );

  redirectToStripe(checkoutUrl);
}
