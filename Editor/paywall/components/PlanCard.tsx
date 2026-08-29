import React from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { PlanDefinition } from '../types/plan.types';
import { FEATURE_LABELS } from '../config/plans';
import { formatPrice } from '../../subscription/payments/paymentStatus';
import '../styles/paywall.css';

interface PlanCardProps {
  plan: PlanDefinition;
  /** The plan the user is on right now. */
  isCurrent: boolean;
  /** True while a checkout redirect for this card is in flight. */
  busy?: boolean;
  /** Label reflects upgrade vs downgrade — decided by the caller. */
  actionLabel: string;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * One plan, presented. Pure display: it reads a PlanDefinition and calls back.
 * It never touches Stripe or the access rules itself.
 */
export function PlanCard({ plan, isCurrent, busy, actionLabel, disabled, onSelect }: PlanCardProps) {
  return (
    <article className={`plan-card ${plan.recommended ? 'is-recommended' : ''} ${isCurrent ? 'is-current' : ''}`}>
      {plan.recommended && (
        <span className="plan-card__ribbon">
          <Sparkles size={11} /> Most popular
        </span>
      )}

      <header className="plan-card__head">
        <h3 className="plan-card__name">{plan.name}</h3>
        <p className="plan-card__tagline">{plan.tagline}</p>
      </header>

      <p className="plan-card__price">
        <strong>{formatPrice(plan.priceMonthlyCents, plan.currency)}</strong>
        {plan.priceMonthlyCents > 0 && <span className="plan-card__period">/month</span>}
      </p>

      <ul className="plan-card__features">
        {plan.features.length === 0 ? (
          <li className="plan-card__feature plan-card__feature--muted">Core editing, watermarked exports</li>
        ) : (
          plan.features.map((f) => (
            <li key={f} className="plan-card__feature">
              <Check size={13} strokeWidth={2.6} />
              {FEATURE_LABELS[f]}
            </li>
          ))
        )}
      </ul>

      <button
        className={`plan-card__cta ${plan.recommended ? 'is-primary' : ''}`}
        onClick={onSelect}
        disabled={disabled || isCurrent || busy}
      >
        {busy ? <Loader2 size={14} className="plan-card__spinner" /> : null}
        {isCurrent ? 'Current plan' : actionLabel}
      </button>
    </article>
  );
}
