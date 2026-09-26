import { ReactNode } from "react";

interface SubscriptionGateProps {
  children: ReactNode;
}

/**
 * No longer gates anything — every signed-in user goes straight into the
 * workspace on /dashboard. The subscription check this used to block on
 * (VITE_WORKER_URL) has never been configured, so this was permanently
 * showing the plans page instead of the actual Dashboard the user wants.
 */
export function SubscriptionGate({ children }: SubscriptionGateProps) {
  return <>{children}</>;
}
