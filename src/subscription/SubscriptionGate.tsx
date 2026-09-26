import { ReactNode } from "react";

interface SubscriptionGateProps {
  children: ReactNode;
}

/**
 * No longer gates anything — every signed-in user goes straight into the
 * workspace. The subscription check this used to block on (VITE_WORKER_URL)
 * was never configured, so this was permanently showing the paywall with a
 * "couldn't load subscription details" error instead of the app.
 */
export function SubscriptionGate({ children }: SubscriptionGateProps) {
  return <>{children}</>;
}
