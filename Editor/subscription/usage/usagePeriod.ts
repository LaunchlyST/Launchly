/**
 * Counting what has been used this billing period.
 *
 * This lives on the subscription side because a usage period is defined by
 * the billing period — it resets when Stripe's `currentPeriodEnd` rolls over.
 * The paywall only *reads* the resulting counters when resolving access.
 */
import { LimitKey } from '../../paywall/types/plan.types';
import { UsageCounters } from '../../paywall/types/access.types';

export interface UsagePeriod {
  /** ISO timestamp the counters were last reset. */
  startedAt: string;
  counters: UsageCounters;
}

export function emptyPeriod(now: Date = new Date()): UsagePeriod {
  return { startedAt: now.toISOString(), counters: {} };
}

export function increment(period: UsagePeriod, key: LimitKey, amount = 1): UsagePeriod {
  return {
    ...period,
    counters: { ...period.counters, [key]: (period.counters[key] ?? 0) + amount },
  };
}

/** Undo a consumed unit — e.g. an export that failed before producing a file. */
export function decrement(period: UsagePeriod, key: LimitKey, amount = 1): UsagePeriod {
  return {
    ...period,
    counters: { ...period.counters, [key]: Math.max(0, (period.counters[key] ?? 0) - amount) },
  };
}

/**
 * Rolls the counters over once the paid period the subscription reports has
 * passed the period these counters were started in.
 */
export function rollOverIfNeeded(
  period: UsagePeriod,
  currentPeriodEnd: string | null,
  now: Date = new Date()
): UsagePeriod {
  if (!currentPeriodEnd) return period;
  const started = new Date(period.startedAt).getTime();
  const periodEnd = new Date(currentPeriodEnd).getTime();
  // The recorded period ended after our counters started, and that end has
  // now passed — so we are into a fresh period.
  if (periodEnd > started && now.getTime() >= periodEnd) return emptyPeriod(now);
  return period;
}
