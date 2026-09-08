import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "./auth-store";

/**
 * Base URL of the subscription worker — NOT the frontend worker. Pointing this
 * at the frontend origin makes /api/* fall through to the SPA, which answers
 * every request with index.html; res.json() then dies on "<!doctype ...".
 *
 * In dev we fall back to the local worker. In production there is no sensible
 * fallback: a wrong base URL is a misconfiguration we surface, never localhost.
 */
export const RAW_WORKER_URL = import.meta.env.VITE_WORKER_URL;
export const WORKER_URL = (RAW_WORKER_URL || (import.meta.env.DEV ? "http://localhost:8787" : "")).replace(/\/+$/, "");

const CONFIG_ERROR =
  "Subscription service is not configured (VITE_WORKER_URL). Set it to the subscription worker URL.";

if (!WORKER_URL) {
  console.error(`[useSubscription] ${CONFIG_ERROR}`);
} else if (!import.meta.env.DEV && WORKER_URL === window.location.origin) {
  console.error(
    "[useSubscription] VITE_WORKER_URL points at the frontend origin, not the subscription worker. " +
      "/api/* will return the SPA's HTML instead of JSON."
  );
}

/**
 * fetch + parse that never lets an HTML error page reach JSON.parse. Returns
 * parsed JSON or throws an Error whose message is safe to show/log.
 */
export async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  if (!WORKER_URL) throw new Error(CONFIG_ERROR);

  const res = await fetch(url, init);
  const contentType = res.headers.get("content-type") || "";
  const body = await res.text();

  if (!contentType.includes("application/json")) {
    const preview = body.slice(0, 80).replace(/\s+/g, " ");
    console.error(
      `[useSubscription] Expected JSON from ${url} but got "${contentType || "no content-type"}" ` +
        `(HTTP ${res.status}). First bytes: ${preview}`
    );
    throw new Error(
      res.ok
        ? "Subscription service returned an unexpected response. Check VITE_WORKER_URL."
        : `Subscription service error (HTTP ${res.status}).`
    );
  }

  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    console.error(`[useSubscription] Malformed JSON from ${url}:`, body.slice(0, 200));
    throw new Error("Subscription service returned malformed data.");
  }

  if (!res.ok) {
    throw new Error(data?.error || `Subscription service error (HTTP ${res.status}).`);
  }

  return data;
}

export interface SubscriptionStatus {
  subscription_status: "active" | "inactive" | "cancelled" | "past_due";
  subscription_current_period_end: string | null;
}

export function useSubscription() {
  const user = useAuthStore((s) => s.user);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription({ subscription_status: "inactive", subscription_current_period_end: null });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchJson(
        `${WORKER_URL}/api/subscription?userId=${encodeURIComponent(user.id)}`
      );
      setSubscription(data);
      setError(null);
    } catch (err: any) {
      console.error("[useSubscription] Failed to fetch subscription:", err);
      setError(err.message);
      setSubscription({ subscription_status: "inactive", subscription_current_period_end: null });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const createCheckout = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const data = await fetchJson(`${WORKER_URL}/api/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
        setCheckoutLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to start checkout");
      setCheckoutLoading(false);
    }
  };

  const manageSubscription = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const data = await fetchJson(`${WORKER_URL}/api/manage-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
        setCheckoutLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to open subscription management");
      setCheckoutLoading(false);
    }
  };

  const isActive = subscription?.subscription_status === "active";

  return {
    subscription,
    loading,
    checkoutLoading,
    error,
    isActive,
    createCheckout,
    manageSubscription,
    refresh: fetchSubscription,
  };
}
