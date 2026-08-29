/**
 * The hook feature code calls.
 *
 *   const { canUse, requireFeature } = usePaywall();
 *   if (!canUse('export.4k')) return;                  // just check
 *   requireFeature('export.4k', () => startExport());  // check, else prompt
 *
 * It answers from the resolved access snapshot only. It cannot start a
 * payment — blocking returns a decision, and the UI decides whether to show
 * the upgrade prompt that leads to checkout.
 */
import { useCallback, useMemo, useState } from 'react';
import { FeatureKey, LimitKey, PlanId } from '../types/plan.types';
import { AccessDecision } from '../types/access.types';
import { createFeatureGate } from '../gate/featureGate';
import { resolveAccess } from '../access/accessRules';
import { useSubscriptionStore } from '../../subscription/hooks/useSubscription';

export interface PaywallPrompt extends AccessDecision {
  /** What the user tried to do, for the modal heading. */
  attempted: FeatureKey | LimitKey;
}

export function usePaywall() {
  const subscription = useSubscriptionStore((s) => s.subscription);
  const usage = useSubscriptionStore((s) => s.usage);
  const recordUsage = useSubscriptionStore((s) => s.recordUsage);

  /** The blocked attempt currently being shown to the user, if any. */
  const [prompt, setPrompt] = useState<PaywallPrompt | null>(null);

  const snapshot = useMemo(() => resolveAccess(subscription, usage.counters), [subscription, usage.counters]);
  const gate = useMemo(() => createFeatureGate(snapshot), [snapshot]);

  const canUse = useCallback((feature: FeatureKey) => gate.feature(feature).allowed, [gate]);

  /** Runs `action` if allowed; otherwise raises a paywall prompt. */
  const requireFeature = useCallback(
    (feature: FeatureKey, action: () => void) => {
      const decision = gate.feature(feature);
      if (decision.allowed) return action();
      setPrompt({ ...decision, attempted: feature });
    },
    [gate]
  );

  /** Runs `action` if there is allowance left, and counts it if so. */
  const requireAllowance = useCallback(
    (key: LimitKey, action: () => void, amount = 1) => {
      const decision = gate.limit(key, amount);
      if (!decision.allowed) return setPrompt({ ...decision, attempted: key });
      recordUsage(key, amount);
      action();
    },
    [gate, recordUsage]
  );

  return {
    /** The plan actually in force right now (Free if the subscription lapsed). */
    planId: snapshot.planId as PlanId,
    access: snapshot,
    canUse,
    checkFeature: gate.feature,
    checkLimit: gate.limit,
    requireFeature,
    requireAllowance,
    prompt,
    dismissPrompt: () => setPrompt(null),
  };
}
