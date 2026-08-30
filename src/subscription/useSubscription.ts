import { useCallback, useState } from 'react';
import { BillingPeriod, PlanId, SubscriptionState } from './subscription.types';

const DEFAULT: SubscriptionState = {
  planId: 'free',
  period: 'monthly',
  status: 'active',
};

export function useSubscription(initial: SubscriptionState = DEFAULT) {
  const [sub, setSub] = useState<SubscriptionState>(initial);
  const [open, setOpen] = useState(false);

  const setPlan = useCallback((planId: PlanId) => {
    setSub((s) => ({ ...s, planId }));
  }, []);

  const setPeriod = useCallback((period: BillingPeriod) => {
    setSub((s) => ({ ...s, period }));
  }, []);

  const subscribe = useCallback((planId: PlanId, period: BillingPeriod) => {
    setSub({ planId, period, status: 'active', renewsAt: new Date(Date.now() + 30 * 86400000).toISOString() });
    setOpen(false);
  }, []);

  const cancel = useCallback(() => setSub((s) => ({ ...s, status: 'canceled' })), []);

  return { sub, open, setOpen, setPlan, setPeriod, subscribe, cancel };
}
