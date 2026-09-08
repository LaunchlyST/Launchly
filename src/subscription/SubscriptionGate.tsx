import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useSubscription } from "../useSubscription";
import { CheckCircle, XCircle } from "lucide-react";
import { Paywall } from "../paywall/Paywall";

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { isActive, loading, checkoutLoading, createCheckout, refresh, error } = useSubscription();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // True while we are waiting for the webhook after a completed checkout. The
  // paywall must never be shown in this window -- the user has already paid.
  const [verifying, setVerifying] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("subscription") === "success" || params.get("checkout") === "success";
  });
  const [unlocking, setUnlocking] = useState(false);
  const [unlockDone, setUnlockDone] = useState(false);
  const cameFromCheckout = useRef(false);

  // Handle post-checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get("subscription") || params.get("checkout");

    if (subscription === "success") {
      cameFromCheckout.current = true;
      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);

      // Poll for subscription status until active
      let attempts = 0;
      const maxAttempts = 15;
      const poll = setInterval(async () => {
        attempts++;
        await refresh();
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setVerifying(false);
          setToast({ type: "error", message: "Payment received — still activating. Refresh in a moment." });
          setTimeout(() => setToast(null), 6000);
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

  // Entitlement landed while we were polling: stop verifying and run the
  // unlock cinematic once, for this checkout only.
  useEffect(() => {
    if (isActive && verifying) {
      setVerifying(false);
      if (cameFromCheckout.current && !unlockDone) setUnlocking(true);
    }
  }, [isActive, verifying, unlockDone]);

  const handleUnlockComplete = useCallback(() => {
    setUnlockDone(true);
    setUnlocking(false);
    setToast({ type: "success", message: "Pro activated!" });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const banner = toast && (
    <div className={`sub-toast sub-toast--${toast.type}`}>
      {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
      <span>{toast.message}</span>
    </div>
  );

  // Never flash the paywall while entitlement is unknown or being confirmed.
  if (loading || verifying) {
    return <Paywall verifying onUnlock={createCheckout} />;
  }

  if (unlocking && !unlockDone) {
    return <Paywall unlocking onUnlock={createCheckout} onUnlockComplete={handleUnlockComplete} />;
  }

  if (!isActive) {
    return (
      <>
        {banner}
        <Paywall
          onUnlock={createCheckout}
          busy={checkoutLoading}
          error={error}
          onDismiss={() => window.location.assign('/')}
        />
      </>
    );
  }

  return (
    <>
      {banner}
      {children}
    </>
  );
}
