import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { DashboardScene } from '../../generator/DashboardScene';
import { useSubscription } from '../../useSubscription';

export function PricingPage() {
  const { createCheckout, manageSubscription, checkoutLoading, isActive, loading, refresh } = useSubscription();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [plansVisible, setPlansVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get('subscription');

    if (subscription === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      setToast({ type: 'success', message: 'Activating your subscription...' });

      let attempts = 0;
      const maxAttempts = 15;
      const poll = setInterval(async () => {
        attempts++;
        await refresh();
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setToast({ type: 'success', message: 'Pro activated!' });
          setTimeout(() => setToast(null), 4000);
        }
      }, 2000);

      return () => clearInterval(poll);
    }

    if (subscription === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
      setToast({ type: 'error', message: 'Checkout cancelled.' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [refresh]);

  useEffect(() => {
    if (isActive && toast?.message === 'Activating your subscription...') {
      setToast({ type: 'success', message: 'Pro activated!' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [isActive, toast]);

  if (loading) {
    return (
      <DashboardScene>
        <div className="sub-loading">
          <Loader2 className="sub-spinner" />
        </div>
      </DashboardScene>
    );
  }

  return (
    <DashboardScene
      revealed={plansVisible}
      onReveal={() => setPlansVisible(true)}
      intro={
        <>
          <h1 className="unpaid-intro__title">Your next creation starts here.</h1>
          <button className="unpaid-intro__button" type="button" onClick={() => setPlansVisible(true)}>
            Explore plans
          </button>
        </>
      }
    >
      {toast && (
        <div className={`sub-toast sub-toast--${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      <section className={`unpaid-plans ${plansVisible ? 'is-visible' : ''}`} aria-label="Launchly plans">
        <article className="plan-card plan-card--free">
          <div className="plan-card__accent" />
          <p className="plan-card__eyebrow">Start here</p>
          <h2>Free</h2>
          <div className="plan-card__price">£0</div>
          <p className="plan-card__desc">Explore Launchly before upgrading.</p>
          <ul>
            <li>Create and access your Launchly account</li>
            <li>View available plan options</li>
            <li>Keep subscription status synced</li>
          </ul>
          <button className="plan-card__button plan-card__button--muted" type="button" disabled>
            Start free
          </button>
        </article>

        <article className="plan-card plan-card--model">
          <div className="plan-card__accent" />
          <p className="plan-card__eyebrow">AI creation</p>
          <h2>Model Access</h2>
          <div className="plan-card__price">£5/month</div>
          <p className="plan-card__desc">Access the available AI models to create your content.</p>
          <ul>
            <li>Unlocks the current image and video editor</li>
            <li>Requires your own OpenAI or Grok API keys</li>
            <li>Provider API charges are paid separately</li>
          </ul>
          <button
            onClick={isActive ? manageSubscription : createCheckout}
            className="plan-card__button plan-card__button--primary"
            type="button"
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <>
                <Loader2 className="sub-spinner--sm" />
                Opening...
              </>
            ) : isActive ? (
              'Manage subscription'
            ) : (
              'Get model access'
            )}
          </button>
        </article>

        <article className="plan-card plan-card--affiliate">
          <div className="plan-card__accent" />
          <p className="plan-card__eyebrow">Workflow</p>
          <h2>Affiliate Toolkit</h2>
          <div className="plan-card__price">Coming soon</div>
          <p className="plan-card__desc">Access features and tools to help with your TikTok Shop affiliate workflow.</p>
          <ul>
            <li>Billing portal support</li>
            <li>Subscription status tracking</li>
            <li>Toolkit features are not configured yet</li>
          </ul>
          <button className="plan-card__button" type="button" disabled>
            Get affiliate tools
          </button>
        </article>
      </section>
    </DashboardScene>
  );
}
