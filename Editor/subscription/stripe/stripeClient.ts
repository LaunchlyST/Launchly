/**
 * The only module that talks to the billing backend from the browser.
 *
 * Deliberately thin: Stripe Checkout is a redirect, so the client's whole job
 * is to ask our backend for a session URL and send the user there. No card
 * details are ever handled by this app.
 */
import { STRIPE_CONFIG } from '../config/stripeConfig';

/** A failure from the payment system, never from the access system. */
export class StripeRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'StripeRequestError';
  }
}

/**
 * POSTs to a backend billing endpoint. The backend holds the secret key and
 * is the only place that may call Stripe's API directly.
 */
export async function postToBilling<T>(endpoint: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${STRIPE_CONFIG.apiBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new StripeRequestError('Could not reach the payment service.');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new StripeRequestError(detail || `Payment service returned ${res.status}.`, res.status);
  }
  return (await res.json()) as T;
}

/** GETs from a backend billing endpoint. */
export async function getFromBilling<T>(endpoint: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${STRIPE_CONFIG.apiBaseUrl}${endpoint}`, { credentials: 'include' });
  } catch {
    throw new StripeRequestError('Could not reach the payment service.');
  }
  if (!res.ok) throw new StripeRequestError(`Payment service returned ${res.status}.`, res.status);
  return (await res.json()) as T;
}

/** Hands the browser over to Stripe-hosted Checkout or the billing portal. */
export function redirectToStripe(url: string): void {
  window.location.assign(url);
}
