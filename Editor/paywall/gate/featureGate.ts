/**
 * The gate call sites use. Wraps an access snapshot so a feature check reads
 * as one line, and always returns a decision the UI can turn into a prompt.
 *
 *   const gate = createFeatureGate(snapshot);
 *   if (!gate.feature('export.4k').allowed) return openPaywall(...);
 */
import { FeatureKey, LimitKey } from '../types/plan.types';
import { AccessDecision, AccessSnapshot } from '../types/access.types';
import { canConsume, canUseFeature } from '../access/accessRules';

export interface FeatureGate {
  feature(key: FeatureKey): AccessDecision;
  limit(key: LimitKey, amount?: number): AccessDecision;
  /**
   * Runs `action` only if the plan allows it. Always returns the decision so
   * a blocked caller can prompt an upgrade instead of failing silently.
   */
  guard<T>(key: FeatureKey, action: () => T): { decision: AccessDecision; result?: T };
}

export function createFeatureGate(snapshot: AccessSnapshot): FeatureGate {
  return {
    feature: (key) => canUseFeature(snapshot, key),
    limit: (key, amount = 1) => canConsume(snapshot, key, amount),
    guard: (key, action) => {
      const decision = canUseFeature(snapshot, key);
      return decision.allowed ? { decision, result: action() } : { decision };
    },
  };
}
