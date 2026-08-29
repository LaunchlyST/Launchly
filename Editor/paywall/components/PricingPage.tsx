import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { PlanId } from '../types/plan.types';
import { listPlans, isDowngrade } from '../plans/planRegistry';
import { usePaywall } from '../hooks/usePaywall';
import { useSubscriptionStore } from '../../subscription/hooks/useSubscription';
import { isStripeConfigured } from '../../subscription/config/stripeConfig';
import { PlanCard } from './PlanCard';
import '../styles/paywall.css';

/**
 * The pricing page. It renders plans from config and hands the chosen plan to
 * the payment side — it makes no access decision and holds no Stripe logic.
 */
export function PricingPage() {
  const { planId: current } = usePaywall();
  const subscribeTo = useSubscriptionStore((s) => s.subscribeTo);
  const error = useSubscriptionStore((s) => s.error);

  const [pending, setPending] = useState<PlanId | null>(null);
  const configured = isStripeConfigured();

  const handleSelect = async (planId: PlanId) => {
    setPending(planId);
    await subscribeTo(planId); // money side — redirects to Stripe on success
    setPending(null);
  };

  return (
    <section className="pricing-page">
      <header className="pricing-page__head">
        <h1 className="pricing-page__title">Choose your plan</h1>
        <p className="pricing-page__subtitle">Upgrade or cancel at any time. Your projects stay yours.</p>
      </header>

      {!configured && (
        <p className="pricing-page__notice">
          <AlertCircle size={14} />
          Stripe isn’t connected yet — add your publishable key and Price IDs to start taking payments.
        </p>
      )}

      {error && (
        <p className="pricing-page__notice pricing-page__notice--error">
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      <div className="pricing-page__grid">
        {listPlans().map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === current}
            busy={pending === plan.id}
            disabled={!configured && plan.priceMonthlyCents > 0}
            actionLabel={
              plan.priceMonthlyCents === 0
                ? 'Downgrade to Free'
                : isDowngrade(current, plan.id)
                  ? `Switch to ${plan.name}`
                  : `Upgrade to ${plan.name}`
            }
            onSelect={() => handleSelect(plan.id)}
          />
        ))}
      </div>
    </section>
  );
}
