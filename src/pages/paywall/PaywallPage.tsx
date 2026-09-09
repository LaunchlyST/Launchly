import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useSubscription } from '../../useSubscription';
import { Paywall } from './Paywall';
import { DashboardPaywall } from './DashboardPaywall';
import { Toast } from '../../ui';

/**
 * The Paywall page (/paywall).
 *
 * An unpaid visitor meets the scenic gate; an active subscriber gets the
 * manage view with their renewal date. It also handles the return from Stripe:
 * it polls until the webhook lands, then sends the new subscriber straight
 * Inside.
 */
export function PaywallPage({
  onBackToEditor,
  onSubscribed,
}: {
  onBackToEditor: () => void;
  /** Fired once a fresh checkout has been confirmed, to send them Inside. */
  onSubscribed?: () => void;
}) {
  const { subscription, createCheckout, manageSubscription, checkoutLoading, isActive, loading, error, refresh } =
    useSubscription();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Handle post-checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get("subscription");

    if (subscription === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      setToast({ type: "success", message: "Activating your subscription..." });

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

  /* The webhook landed while we were polling: say so, then go Inside. The
     redirect only fires for a checkout we just handled, never for someone who
     opened this page with an existing subscription. */
  useEffect(() => {
    if (isActive && toast?.message === "Activating your subscription...") {
      setToast({ type: "success", message: "You're in — opening your workspace…" });
      const t = setTimeout(() => {
        setToast(null);
        onSubscribed?.();
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [isActive, toast, onSubscribed]);

  if (loading) {
    return <Paywall verifying onUnlock={createCheckout} />;
  }

  return (
    <>
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          icon={toast.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
        />
      )}
      {isActive ? (
        <Paywall
          variant="active"
          onUnlock={createCheckout}
          onManage={manageSubscription}
          onBack={onBackToEditor}
          renewsOn={subscription?.subscription_current_period_end ?? null}
          busy={checkoutLoading}
        />
      ) : (
        /* An unpaid visitor meets the same scenic gate here as on /dashboard,
           so both URLs show one offer rather than two different ones. */
        <DashboardPaywall
          onUnlock={createCheckout}
          busy={checkoutLoading}
          error={error}
        />
      )}
    </>
  );
}
