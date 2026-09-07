import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "./auth-store";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";

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
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${WORKER_URL}/api/subscription?userId=${user.id}`);
      const data = await res.json();
      setSubscription(data);
      setError(null);
    } catch (err: any) {
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
      const res = await fetch(`${WORKER_URL}/api/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });

      const data = await res.json();
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
      const res = await fetch(`${WORKER_URL}/api/manage-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();
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
