import { ReactNode, useEffect, useState } from "react";
import { useSubscription } from "../useSubscription";
import { Crown, Loader2, CheckCircle, XCircle } from "lucide-react";

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { isActive, loading, checkoutLoading, createCheckout, manageSubscription, refresh } = useSubscription();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Handle post-checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get("subscription");

    if (subscription === "success") {
      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);
      setToast({ type: "success", message: "Activating your subscription..." });

      // Poll for subscription status until active
      let attempts = 0;
      const maxAttempts = 15;
      const poll = setInterval(async () => {
        attempts++;
        await refresh();
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setToast({ type: "success", message: "Pro activated!" });
          setTimeout(() => setToast(null), 4000);
        }
      }, 2000);

      return () => clearInterval(poll);
    }

    if (subscription === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
      setToast({ type: "error", message: "Checkout cancelled." });
      setTimeout(() => setToast(null), 4000);
    }
  }, [refresh]);

  // Show success toast after subscription becomes active during polling
  useEffect(() => {
    if (isActive && toast?.message === "Activating your subscription...") {
      setToast({ type: "success", message: "Pro activated!" });
      setTimeout(() => setToast(null), 4000);
    }
  }, [isActive, toast]);

  if (loading) {
    return (
      <div className="sub-loading">
        <Loader2 className="sub-spinner" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <>
        {toast && (
          <div className={`sub-toast sub-toast--${toast.type}`}>
            {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span>{toast.message}</span>
          </div>
        )}
        <div className="sub-gate">
          <div className="sub-gate__icon">
            <Crown size={48} />
          </div>
          <h2 className="sub-gate__title">Pro Subscription Required</h2>
          <p className="sub-gate__desc">
            Unlock the full editor with all features. Only £5/month.
          </p>
          <button
            onClick={createCheckout}
            className="sub-gate__btn"
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <>
                <Loader2 className="sub-spinner--sm" />
                Opening checkout...
              </>
            ) : (
              "Subscribe Now — £5/month"
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {toast && (
        <div className={`sub-toast sub-toast--${toast.type}`}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
      {children}
    </>
  );
}
