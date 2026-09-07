import { ReactNode, useEffect } from "react";
import { useSubscription } from "../useSubscription";
import { Crown, Loader2 } from "lucide-react";

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { isActive, loading, createCheckout, refresh } = useSubscription();

  // Handle post-checkout redirect: refresh subscription status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("session_id")) {
      // Clear the session_id from URL and refresh subscription
      window.history.replaceState({}, "", window.location.pathname);
      const timer = setTimeout(() => refresh(), 2000);
      return () => clearTimeout(timer);
    }
    if (params.get("cancelled")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refresh]);

  if (loading) {
    return (
      <div className="sub-loading">
        <Loader2 className="sub-spinner" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="sub-gate">
        <div className="sub-gate__icon">
          <Crown size={48} />
        </div>
        <h2 className="sub-gate__title">Pro Subscription Required</h2>
        <p className="sub-gate__desc">
          Unlock the full editor with all features. Only £5/month.
        </p>
        <button onClick={createCheckout} className="sub-gate__btn">
          Subscribe Now — £5/month
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
