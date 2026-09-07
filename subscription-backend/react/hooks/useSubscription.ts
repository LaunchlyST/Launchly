import { useState, useEffect, useCallback } from "react";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";

export interface SubscriptionStatus {
  subscription_status: "active" | "inactive" | "cancelled" | "past_due";
  subscription_current_period_end: string | null;
}

export function useSubscription(userId: string | null, userEmail: string | null) {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${WORKER_URL}/api/subscription?userId=${userId}`);
      const data = await res.json();
      setSubscription(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setSubscription({ subscription_status: "inactive", subscription_current_period_end: null });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const createCheckout = async () => {
    if (!userId || !userEmail) return;

    const res = await fetch(`${WORKER_URL}/api/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email: userEmail }),
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
