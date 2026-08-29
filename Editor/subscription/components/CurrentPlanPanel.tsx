import React from 'react';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { useSubscriptionStore } from '../hooks/useSubscription';
import { AccessSnapshot } from '../../paywall/types/access.types';
import { getPlan } from '../../paywall/plans/planRegistry';
import { describeStatus, formatPrice, isRecoverable } from '../payments/paymentStatus';
import '../styles/billing.css';

interface CurrentPlanPanelProps {
  /**
   * The resolved access picture, passed in by whatever composes this panel
   * (usually via `usePaywall()`). Taking it as a prop keeps this billing
   * component free of any dependency on the paywall's rules or hooks.
   */
  access: AccessSnapshot;
}

/** Formats an ISO date for the renewal line. */
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Billing summary: current plan, status, renewal date, allowance meters, and
 * the single button that opens Stripe's portal for anything transactional.
 */
export function CurrentPlanPanel({ access }: CurrentPlanPanelProps) {
  const subscription = useSubscriptionStore((s) => s.subscription);
  const manageBilling = useSubscriptionStore((s) => s.manageBilling);
  const loading = useSubscriptionStore((s) => s.loading);

  const plan = getPlan(access.planId);
  const meters = Object.values(access.limits).filter((l) => l.allowed !== null);

  return (
    <section className="current-plan">
      <header className="current-plan__head">
        <div>
          <span className="current-plan__label">Your plan</span>
          <h2 className="current-plan__name">
            {plan.name}
            <span className={`current-plan__status is-${subscription.status}`}>
              {describeStatus(subscription.status)}
            </span>
          </h2>
        </div>
        <span className="current-plan__price">{formatPrice(plan.priceMonthlyCents, plan.currency)}</span>
      </header>

      {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
        <p className="current-plan__note">
          Cancelled — you keep {plan.name} until {formatDate(subscription.currentPeriodEnd)}.
        </p>
      )}

      {isRecoverable(subscription.status) && (
        <p className="current-plan__note current-plan__note--warn">
          {subscription.lastPaymentError ?? 'Your last payment failed.'} Update your card to keep {plan.name}.
        </p>
      )}

      {!subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
        <p className="current-plan__note">Renews {formatDate(subscription.currentPeriodEnd)}.</p>
      )}

      {meters.length > 0 && (
        <ul className="current-plan__meters">
          {meters.map((l) => (
            <li key={l.key} className={`usage-meter ${l.exhausted ? 'is-exhausted' : ''}`}>
              <span className="usage-meter__label">{l.key}</span>
              <span className="usage-meter__track">
                <span
                  className="usage-meter__fill"
                  style={{ width: `${Math.min(100, (l.used / (l.allowed || 1)) * 100)}%` }}
                />
              </span>
              <span className="usage-meter__value">
                {l.used} / {l.allowed}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button className="current-plan__manage" onClick={manageBilling} disabled={loading}>
        {loading ? <Loader2 size={14} /> : <CreditCard size={14} />}
        Manage billing
        <ExternalLink size={12} />
      </button>
    </section>
  );
}
