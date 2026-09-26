import { Check } from 'lucide-react';
import { FeedbackMenu } from './FeedbackMenu';
import { PLANS } from './plans';
import './dashboard-paywall.css';

export interface DashboardPaywallProps {
  /** The existing Stripe checkout handler. Unchanged. */
  onUnlock: () => void | Promise<void>;
  /** The Free card ("enter" action) sends them straight to the dashboard. */
  onEnter?: () => void;
  busy?: boolean;
  error?: string | null;
}

/**
 * The unpaid gate on /dashboard.
 *
 * Plain and static — no scenery, no scroll-driven camera. Just the plans.
 */
export function DashboardPaywall({ onUnlock, onEnter, busy = false, error = null }: DashboardPaywallProps) {
  const handleUnlock = async () => {
    if (busy) return;
    await onUnlock(); // unchanged Stripe checkout
  };

  return (
    <div className="dp dp--flat">
      <header className="dp__chrome">
        <p className="dp__badge">Launchly</p>
        <div className="dp__chrome-right">
          <FeedbackMenu />
        </div>
      </header>

      <section className="dp__stage">
        <div className="dp__sticky">
          <div className="dp__intro">
            <h1 className="dp__intro-title">Choose your plan</h1>
          </div>

          <div className="dp__plans">
            {PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`dp__card ${plan.featured ? 'dp__card--featured' : ''}`}
              >
                {plan.featured && <span className="dp__tag">Full workspace</span>}
                <h2 className="dp__card-name">{plan.name}</h2>
                <p className="dp__card-note">{plan.note}</p>

                <p className="dp__card-price">
                  <span className={`dp__amount ${plan.period ? '' : /\d/.test(plan.price) ? '' : 'dp__amount--words'}`}>
                    {plan.price}
                  </span>
                  {plan.period && <span className="dp__period">{plan.period}</span>}
                </p>

                <ul className="dp__list">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Check size={13} strokeWidth={2.6} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="dp__card-foot">
                  {plan.action === 'checkout' ? (
                    <button
                      type="button"
                      className="dp__cta"
                      onClick={handleUnlock}
                      disabled={busy}
                    >
                      {busy ? 'Opening Stripe…' : 'Get access'}
                    </button>
                  ) : plan.action === 'enter' ? (
                    <button type="button" className="dp__cta" onClick={onEnter}>
                      Continue with Free
                    </button>
                  ) : (
                    <p className="dp__status" aria-live="off">
                      Not available yet
                    </p>
                  )}
                  <p className="dp__fine">{plan.fine}</p>
                </div>
              </article>
            ))}

            {error && (
              <p className="dp__error" role="status">
                We couldn’t load subscription details right now. Please try again.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
