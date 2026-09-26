import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Env } from "./types";
import { json } from "./types";
import {
  handleCreatorApiCheckout,
  handleCreatorApiManage,
  handleCreatorApiStatus,
  markApiSubscriptionCanceled,
  resolveApiSubscriptionUserId,
  upsertApiSubscriptionFromStripe,
} from "./creatorApiSubscription";
import { handleApiUsage, handleCreateApiKey, handleListApiKeys, handleRevokeApiKey } from "./apiKeys";
import { handleCreatorSearchApi } from "./creatorSearchApi";
import { handleCreatorApiSearch } from "./creatorApiSearch";
import { handleCreatorApiDebug } from "./creatorApiDebug";
import { handleStatus } from "./statusApi";
import { handleBusinessConnect, isBusinessRoute } from "./business/businessRoutes";

export type { Env };

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/create-checkout" && request.method === "POST") {
        return await handleCreateCheckout(request, env);
      }

      if (url.pathname === "/api/webhook" && request.method === "POST") {
        return await handleWebhook(request, env);
      }

      if (url.pathname === "/api/subscription" && request.method === "GET") {
        return await handleGetSubscription(request, env);
      }

      if (url.pathname === "/api/manage-subscription" && request.method === "POST") {
        return await handleManageSubscription(request, env);
      }

      // ---- Search Creator API: subscription management (authenticated) ----
      if (url.pathname === "/api/creator-api-subscription/checkout" && request.method === "POST") {
        return await handleCreatorApiCheckout(request, env);
      }
      if (url.pathname === "/api/creator-api-subscription/manage" && request.method === "POST") {
        return await handleCreatorApiManage(request, env);
      }
      if (url.pathname === "/api/creator-api-subscription/status" && request.method === "GET") {
        return await handleCreatorApiStatus(request, env);
      }
      if (url.pathname === "/api/creator-api-subscription/debug" && request.method === "GET") {
        return await handleCreatorApiDebug(request, env);
      }

      // ---- Search Creator API: key management (authenticated) ----
      if (url.pathname === "/api/developer/api-keys" && request.method === "POST") {
        return await handleCreateApiKey(request, env);
      }
      if (url.pathname === "/api/developer/api-keys" && request.method === "GET") {
        return await handleListApiKeys(request, env);
      }
      if (url.pathname === "/api/developer/api-usage" && request.method === "GET") {
        return await handleApiUsage(request, env);
      }
      const revokeMatch = url.pathname.match(/^\/api\/developer\/api-keys\/([^/]+)\/revoke$/);
      if (revokeMatch && request.method === "POST") {
        return await handleRevokeApiKey(request, env, revokeMatch[1]);
      }

      // ---- Search Creator API: public health check, no auth ----
      if (url.pathname === "/api/v1/status" && request.method === "GET") {
        return await handleStatus(env);
      }

      // ---- Search Creator API: the public, paid, Bearer-authenticated endpoint ----
      if (url.pathname === "/api/v1/creators/search" && request.method === "GET") {
        return await handleCreatorSearchApi(request, env);
      }

      // ---- In-app search (session-authenticated, not a Bearer API key) ----
      if (url.pathname === "/api/creator-api/search" && request.method === "GET") {
        return await handleCreatorApiSearch(request, env);
      }

      // ---- Business Connect (session-authenticated) ----
      if (isBusinessRoute(url.pathname)) {
        return await handleBusinessConnect(request, env);
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err: any) {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function handleCreateCheckout(request: Request, env: Env): Promise<Response> {
  const { userId, email } = await request.json<{ userId?: string; email?: string }>();

  if (!userId || !email) {
    return json({ error: "Missing userId or email" }, 400);
  }

  const supabase = getSupabase(env);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
  });

  // Check if user already has a stripe customer ID
  const { data: existingUser } = await supabase
    .from("users")
    .select("stripe_customer_id, subscription_status")
    .eq("id", userId)
    .single();

  // If already active, don't create another checkout
  if (existingUser?.subscription_status === "active") {
    return json({ error: "Already subscribed" }, 400);
  }

  let customerId = existingUser?.stripe_customer_id;

  // Create Stripe customer if doesn't exist
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;

    await supabase
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    success_url: `${env.FRONTEND_URL}/paywall?subscription=success`,
    cancel_url: `${env.FRONTEND_URL}/paywall?subscription=cancelled`,
    metadata: { supabase_user_id: userId },
  });

  return json({ url: session.url });
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
  });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = getSupabase(env);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const subscriptionId = session.subscription as string;
        const isCreatorApi = session.metadata?.product === "search_creator_api";

        if (userId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          if (isCreatorApi) {
            await upsertApiSubscriptionFromStripe(env, {
              userId,
              customerId: subscription.customer as string,
              subscription,
            });
          } else {
            const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
            await supabase
              .from("users")
              .update({
                stripe_subscription_id: subscriptionId,
                subscription_status: "active",
                subscription_current_period_end: periodEnd,
              })
              .eq("id", userId);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const isCreatorApi = subscription.metadata?.product === "search_creator_api";

        if (isCreatorApi) {
          const userId = await resolveApiSubscriptionUserId(env, {
            customerId,
            subscriptionMetadataUserId: subscription.metadata?.supabase_user_id,
          });
          if (userId) {
            await upsertApiSubscriptionFromStripe(env, { userId, customerId, subscription });
          }
          break;
        }

        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          let status: string;
          switch (subscription.status) {
            case "active":
              status = "active";
              break;
            case "past_due":
              status = "past_due";
              break;
            case "canceled":
            case "unpaid":
              status = "cancelled";
              break;
            default:
              status = "inactive";
          }

          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          await supabase
            .from("users")
            .update({
              subscription_status: status,
              subscription_current_period_end: periodEnd,
            })
            .eq("id", user.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const isCreatorApi = subscription.metadata?.product === "search_creator_api";

        if (isCreatorApi) {
          await markApiSubscriptionCanceled(env, subscription);
          break;
        }

        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("users")
            .update({
              subscription_status: "cancelled",
              stripe_subscription_id: null,
              subscription_current_period_end: null,
            })
            .eq("id", user.id);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const isCreatorApi = subscription.metadata?.product === "search_creator_api";

          if (isCreatorApi) {
            const userId = await resolveApiSubscriptionUserId(env, {
              customerId,
              subscriptionMetadataUserId: subscription.metadata?.supabase_user_id,
            });
            if (userId) {
              await upsertApiSubscriptionFromStripe(env, { userId, customerId, subscription });
            }
            break;
          }

          const { data: user } = await supabase
            .from("users")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (user) {
            const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
            await supabase
              .from("users")
              .update({
                subscription_status: "active",
                subscription_current_period_end: periodEnd,
              })
              .eq("id", user.id);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string | null;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          if (subscription.metadata?.product === "search_creator_api") {
            const userId = await resolveApiSubscriptionUserId(env, {
              customerId,
              subscriptionMetadataUserId: subscription.metadata?.supabase_user_id,
            });
            if (userId) {
              await upsertApiSubscriptionFromStripe(env, { userId, customerId, subscription });
            }
            break;
          }
        }

        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("users")
            .update({ subscription_status: "past_due" })
            .eq("id", user.id);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    // Return 200 to prevent Stripe retries for processing errors
    // (signature verification errors already return 400 above)
  }

  return json({ received: true });
}

async function handleGetSubscription(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return json({ error: "Missing userId" }, 400);
  }

  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from("users")
    .select("subscription_status, subscription_current_period_end")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return json({ subscription_status: "inactive", subscription_current_period_end: null });
  }

  return json(data);
}

async function handleManageSubscription(request: Request, env: Env): Promise<Response> {
  const { userId } = await request.json<{ userId?: string }>();

  if (!userId) {
    return json({ error: "Missing userId" }, 400);
  }

  const supabase = getSupabase(env);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
  });

  const { data: user } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (!user?.stripe_customer_id) {
    return json({ error: "No Stripe customer found" }, 400);
  }

  // Create a billing portal session
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${env.FRONTEND_URL}/dashboard`,
  });

  return json({ url: portalSession.url });
}
