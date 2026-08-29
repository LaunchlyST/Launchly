/**
 * Stripe wiring — keys and endpoints only. No plan or access logic here.
 *
 * The publishable key is safe in the browser. The SECRET key must never
 * appear in this folder or anywhere else in the client bundle: it belongs on
 * the server that creates checkout sessions and verifies webhooks.
 */

export const STRIPE_CONFIG = {
  /** Safe to ship. Set VITE_STRIPE_PUBLISHABLE_KEY in your .env. */
  publishableKey: (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY ?? '',

  /** Your backend. Stripe secret-key calls happen there, never in the browser. */
  apiBaseUrl: (import.meta as any).env?.VITE_API_BASE_URL ?? '/api',

  /** Backend routes this folder talks to. */
  endpoints: {
    /** POST { priceId } → { checkoutUrl } */
    createCheckoutSession: '/billing/checkout-session',
    /** POST {} → { portalUrl } */
    createPortalSession: '/billing/portal-session',
    /** GET → Subscription */
    subscription: '/billing/subscription',
  },

  /** Where Stripe returns the user after checkout. */
  returnUrls: {
    success: `${window.location.origin}/billing/success`,
    cancel: `${window.location.origin}/billing/cancelled`,
  },
} as const;

/** True once a real publishable key is present — used to gate the UI. */
export function isStripeConfigured(): boolean {
  return STRIPE_CONFIG.publishableKey.startsWith('pk_');
}
