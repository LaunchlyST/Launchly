import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const PRICE_ID = "prod_VDSstVJr60UDdR"; // £5/month Launchly Pro

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  FRONTEND_URL: string;
}

const corsHeaders = {
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
      // Create Checkout Session
      if (url.pathname === "/api/create-checkout" && request.method === "POST") {
        return await handleCreateCheckout(request, env);
      }

      // Stripe Webhook
      if (url.pathname === "/api/webhook" && request.method === "POST") {
        return await handleWebhook(request, env);
      }

      // Get subscription status
      if (url.pathname === "/api/subscription" && request.method === "GET") {
        return await handleGetSubscription(request, env);
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

async function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function handleCreateCheckout(request: Request, env: Env): Promise<Response> {
  const { userId, email } = await request.json();

  if (!userId || !email) {
    return new Response(JSON.stringify({ error: "Missing userId or email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = await getSupabase(env);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

  // Check if user already has a stripe customer ID
  const { data: existingUser } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  let customerId = existingUser?.stripe_customer_id;

  // Create Stripe customer if doesn't exist
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;

    // Save customer ID to Supabase
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
        price: PRICE_ID,
        quantity: 1,
      },
    ],
    success_url: `${env.FRONTEND_URL}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_URL}/?cancelled=true`,
    metadata: { supabase_user_id: userId },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = await getSupabase(env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const subscriptionId = session.subscription as string;

      if (userId && subscriptionId) {
        await supabase
          .from("users")
          .update({
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
          })
          .eq("id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Find user by stripe_customer_id
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

        await supabase
          .from("users")
          .update({
            subscription_status: status,
            subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("id", user.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

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
          })
          .eq("id", user.id);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

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

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetSubscription(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = await getSupabase(env);

  const { data, error } = await supabase
    .from("users")
    .select("subscription_status, subscription_current_period_end")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ subscription_status: "inactive" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
