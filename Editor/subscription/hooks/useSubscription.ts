/**
 * The subscription store: the record the PAYMENT side produced, plus the
 * usage counters the access side reads.
 *
 * Note what is NOT here — no feature checks, no plan rules. This folder never
 * imports the paywall; the paywall imports this. One direction only.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LimitKey, PlanId } from '../../paywall/types/plan.types';
import { UsagePeriod, emptyPeriod, increment, rollOverIfNeeded } from '../usage/usagePeriod';
import { Subscription, ANONYMOUS_SUBSCRIPTION } from '../types/subscription.types';
import { fetchSubscription } from '../services/subscriptionService';
import { startCheckout } from '../payments/checkoutService';
import { openBillingPortal } from '../billing/billingPortal';

interface SubscriptionState {
  subscription: Subscription;
  usage: UsagePeriod;
  loading: boolean;
  error: string | null;

  /** Re-reads the record from the backend (after checkout, or on app start). */
  refresh: () => Promise<void>;
  /** Sends the user to Stripe Checkout for `planId`. Money side. */
  subscribeTo: (planId: PlanId) => Promise<void>;
  /** Opens Stripe's portal to change or cancel. Money side. */
  manageBilling: () => Promise<void>;
  /** Records consumption of an allowance. */
  recordUsage: (key: LimitKey, amount?: number) => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      subscription: ANONYMOUS_SUBSCRIPTION,
      usage: emptyPeriod(),
      loading: false,
      error: null,

      refresh: async () => {
        set({ loading: true, error: null });
        const subscription = await fetchSubscription();
        set((s) => ({
          subscription,
          // A new billing period wipes the allowances.
          usage: rollOverIfNeeded(s.usage, subscription.currentPeriodEnd),
          loading: false,
        }));
      },

      subscribeTo: async (planId) => {
        set({ error: null });
        try {
          await startCheckout(planId);
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Checkout could not be started.' });
        }
      },

      manageBilling: async () => {
        set({ error: null });
        try {
          await openBillingPortal();
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Billing portal is unavailable.' });
        }
      },

      recordUsage: (key, amount = 1) => set((s) => ({ usage: increment(s.usage, key, amount) })),
    }),
    {
      name: 'launchly-subscription',
      // Never persist loading/error — the record is re-verified on load.
      partialize: (s) => ({ subscription: s.subscription, usage: s.usage }),
    }
  )
);
