import { ReactNode } from "react";
import { useSubscription } from "../hooks/useSubscription";
import { Crown, Loader2 } from "lucide-react";

interface SubscriptionGateProps {
  userId: string | null;
  userEmail: string | null;
  children: ReactNode;
}

export function SubscriptionGate({ userId, userEmail, children }: SubscriptionGateProps) {
  const { isActive, loading, createCheckout } = useSubscription(userId, userEmail);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 p-6 rounded-2xl mb-6">
          <Crown className="w-16 h-16 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Pro Subscription Required
        </h2>
        <p className="text-gray-400 mb-8 max-w-md">
          Unlock the full editor with all features. Only £5/month.
        </p>
        <button
          onClick={createCheckout}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Subscribe Now — £5/month
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
