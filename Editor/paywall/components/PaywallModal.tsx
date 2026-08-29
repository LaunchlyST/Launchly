import React from 'react';
import { Lock, X } from 'lucide-react';
import { PaywallPrompt } from '../hooks/usePaywall';
import { getPlan } from '../plans/planRegistry';
import { formatPrice } from '../../subscription/payments/paymentStatus';
import { useSubscriptionStore } from '../../subscription/hooks/useSubscription';
import '../styles/paywall.css';

interface PaywallModalProps {
  prompt: PaywallPrompt | null;
  onClose: () => void;
}

const TITLE_BY_REASON: Record<string, string> = {
  plan_required: 'Upgrade to unlock this',
  limit_reached: "You've hit your plan limit",
  subscription_inactive: 'Your subscription has ended',
};

/**
 * Shown when the paywall blocks something. It presents the decision the
 * access rules already made and offers the upgrade — the click hands over to
 * the payment side. This component never decides access itself.
 */
export function PaywallModal({ prompt, onClose }: PaywallModalProps) {
  const subscribeTo = useSubscriptionStore((s) => s.subscribeTo);
  if (!prompt) return null;

  const target = prompt.requiredPlan ? getPlan(prompt.requiredPlan) : null;

  return (
    <div className="paywall-modal__backdrop" role="presentation" onClick={onClose}>
      <div
        className="paywall-modal"
        role="dialog"
        aria-modal="true"
        aria-label={TITLE_BY_REASON[prompt.reason ?? 'plan_required']}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="paywall-modal__close" onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>

        <span className="paywall-modal__icon">
          <Lock size={18} />
        </span>

        <h2 className="paywall-modal__title">{TITLE_BY_REASON[prompt.reason ?? 'plan_required']}</h2>
        {prompt.message && <p className="paywall-modal__body">{prompt.message}</p>}

        <div className="paywall-modal__actions">
          <button className="paywall-modal__btn" onClick={onClose}>
            Not now
          </button>
          {target && (
            <button
              className="paywall-modal__btn paywall-modal__btn--primary"
              onClick={() => {
                onClose();
                subscribeTo(target.id);
              }}
            >
              Get {target.name} — {formatPrice(target.priceMonthlyCents, target.currency)}/mo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
