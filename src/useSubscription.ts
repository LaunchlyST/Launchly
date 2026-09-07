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

    const res = await fetch(`${WORKER_URL}/api/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, email: user.email }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const isActive = subscription?.subscription_status === "active";

  return {
    subscription,
    loading,
    error,
    isActive,
    createCheckout,
    refresh: fetchSubscription,
  };
}
