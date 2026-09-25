import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type { Env } from './types';
import { apiError, json } from './types';
import { getAuthenticatedUserId } from './auth';

const PRODUCT = 'search_creator_api';

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

function getStripe(env: Env) {
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
}

/**
 * The one reusable access check: true only for a subscription Stripe
 * currently reports as `active` (webhook-synced, never client-trusted).
 * `cancel_at_period_end` does not affect this — Stripe keeps `status`
 * "active" for the whole paid period, so access is naturally preserved
 * until the period actually ends and the webhook flips status away.
 */
export async function hasCreatorApiAccess(env: Env, userId: string): Promise<boolean> {
  const supabase = getSupabase(env);
  const { data } = await supabase
    .from('api_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .eq('product', PRODUCT)
    .maybeSingle();
  return data?.status === 'active';
}

/**
 * POST /api/creator-api-subscription/checkout
 *
 * Starts a Stripe Checkout session for the Search Creator API product,
 * completely separate from the main app subscription's checkout. The
 * success redirect is never trusted as proof of payment — only the webhook
 * (see index.ts) writes `api_subscriptions`.
 */
export async function handleCreatorApiCheckout(request: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  if (!env.CREATOR_API_PRICE_ID) {
    // Safe to log: the variable name and that it's missing, never a secret value.
    console.error('[creator-api] CREATOR_API_PRICE_ID is not configured — refusing checkout.');
    return apiError(
      'CREATOR_API_PRICE_NOT_CONFIGURED',
      'Search Creator API billing is not configured.',
      500
    );
  }

  const supabase = getSupabase(env);
  const stripe = getStripe(env);

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (!email) return apiError('UNAUTHENTICATED', 'Could not resolve your account email.', 401);

  const { data: existing } = await supabase
    .from('api_subscriptions')
    .select('stripe_customer_id, status')
    .eq('user_id', userId)
    .eq('product', PRODUCT)
    .maybeSingle();

  if (existing?.status === 'active') {
    return apiError('ALREADY_SUBSCRIBED', 'Search Creator API is already active.', 400);
  }

  // Reuse the same Stripe customer as the main app subscription if one
  // exists, so the user has one customer record across both products.
  let customerId = existing?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const { data: appUser } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();
    customerId = appUser?.stripe_customer_id ?? undefined;
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: env.CREATOR_API_PRICE_ID, quantity: 1 }],
    success_url: `${env.FRONTEND_URL}/settings?section=developer&creatorApi=success`,
    cancel_url: `${env.FRONTEND_URL}/settings?section=developer&creatorApi=cancelled`,
    metadata: { product: PRODUCT, supabase_user_id: userId },
    subscription_data: {
      metadata: { product: PRODUCT, supabase_user_id: userId },
    },
  });

  // Row exists from first checkout onward so re-checking status is cheap;
  // the webhook is what actually flips it to "active".
  await supabase
    .from('api_subscriptions')
    .upsert(
      { user_id: userId, product: PRODUCT, stripe_customer_id: customerId, status: existing ? undefined : 'none' },
      { onConflict: 'user_id,product' }
    );

  return json({ success: true, data: { url: session.url } });
}

/**
 * POST /api/creator-api-subscription/manage
 *
 * Opens the same Stripe customer portal the main app subscription uses —
 * cancellation and payment-method updates for the Search Creator API happen
 * there, same as the rest of billing.
 */
export async function handleCreatorApiManage(request: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  const supabase = getSupabase(env);
  const stripe = getStripe(env);

  const { data: sub } = await supabase
    .from('api_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .eq('product', PRODUCT)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return apiError('NO_SUBSCRIPTION', 'No Search Creator API subscription found.', 400);
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${env.FRONTEND_URL}/settings?section=developer`,
  });

  return json({ success: true, data: { url: portal.url } });
}

/**
 * Called from the shared Stripe webhook (index.ts) whenever an event's
 * subscription/session metadata says `product: "search_creator_api"`. Keeps
 * `api_subscriptions` in sync with Stripe, and never touches `users` — that
 * table is the main app subscription's alone.
 */
export async function upsertApiSubscriptionFromStripe(
  env: Env,
  params: { userId: string; customerId: string; subscription: Stripe.Subscription }
): Promise<void> {
  const { userId, customerId, subscription } = params;
  const supabase = getSupabase(env);

  await supabase.from('api_subscriptions').upsert(
    {
      user_id: userId,
      product: PRODUCT,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: 'user_id,product' }
  );
}

/** customer.subscription.deleted for a Search Creator API subscription. */
export async function markApiSubscriptionCanceled(env: Env, subscription: Stripe.Subscription): Promise<void> {
  const supabase = getSupabase(env);
  await supabase
    .from('api_subscriptions')
    .update({ status: 'canceled', cancel_at_period_end: false })
    .eq('stripe_subscription_id', subscription.id);
}

/** Resolve the Launchly user_id for a Search Creator API Stripe subscription. */
export async function resolveApiSubscriptionUserId(
  env: Env,
  params: { customerId: string; subscriptionMetadataUserId?: string | null }
): Promise<string | null> {
  if (params.subscriptionMetadataUserId) return params.subscriptionMetadataUserId;

  const supabase = getSupabase(env);
  const { data } = await supabase
    .from('api_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', params.customerId)
    .eq('product', PRODUCT)
    .maybeSingle();
  return data?.user_id ?? null;
}

/**
 * GET /api/creator-api-subscription/status
 *
 * The Developer settings page's source of truth for Locked/Active/etc.
 * Never fabricates a billing date — current_period_end is only ever what
 * Stripe (via the webhook) last reported.
 */
export async function handleCreatorApiStatus(request: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  const supabase = getSupabase(env);
  const { data } = await supabase
    .from('api_subscriptions')
    .select('status, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .eq('product', PRODUCT)
    .maybeSingle();

  if (!data) {
    return json({
      success: true,
      data: {
        product: PRODUCT,
        status: 'none',
        active: false,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
  }

  return json({
    success: true,
    data: {
      product: PRODUCT,
      status: data.status,
      active: data.status === 'active',
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
    },
  });
}
