import React, { useState } from 'react';
import { BillingPeriod, Plan } from './subscription.types';

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: { monthly: '$0', yearly: '$0' },
    periodLabel: '/mo',
    features: ['3 projects', '720p export', 'Basic timeline', 'Community support'],
    cta: 'Current plan',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: '$12', yearly: '$96' },
    periodLabel: '/mo',
    features: ['Unlimited projects', '4K export, no watermark', 'All AI tools', '30-day extended timeline', 'Priority support'],
    cta: 'Upgrade to Pro',
    highlight: true,
    badge: 'Most popular',
  },
  {
    id: 'team',
    name: 'Team',
    price: { monthly: '$29', yearly: '$276' },
    periodLabel: '/mo',
    features: ['Everything in Pro', '5 seats included', 'Shared libraries', 'SSO + admin controls'],
    cta: 'Start Team',
  },
];

interface SubscriptionProps {
  open: boolean;
  onClose: () => void;
  onSelectPlan: (planId: string, period: BillingPeriod) => void;
  currentPlanId?: string;
}

export function Subscription({ open, onClose, onSelectPlan, currentPlanId = 'free' }: SubscriptionProps) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  if (!open) return null;

  return (
    <div className="sub-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sub-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sub-header">
          <div>
            <h2 className="sub-title">Choose your plan</h2>
            <p className="sub-subtitle">Upgrade anytime. Cancel anytime.</p>
          </div>
          <button className="sub-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="sub-toggle">
          <button className={`sub-toggle-btn ${period === 'monthly' ? 'active' : ''}`} onClick={() => setPeriod('monthly')}>Monthly</button>
          <button className={`sub-toggle-btn ${period === 'yearly' ? 'active' : ''}`} onClick={() => setPeriod('yearly')}>
            Yearly <span className="sub-save">Save 33%</span>
          </button>
        </div>

        <div className="sub-grid">
          {PLANS.map((p) => (
            <div key={p.id} className={`sub-card ${p.highlight ? 'highlight' : ''} ${currentPlanId === p.id ? 'current' : ''}`}>
              {p.badge && <div className="sub-badge">{p.badge}</div>}
              <h3 className="sub-card-name">{p.name}</h3>
              <div className="sub-price">
                <strong>{p.price[period]}</strong><span>{p.periodLabel}</span>
                {period === 'yearly' && p.id !== 'free' && <em>billed yearly</em>}
              </div>
              <ul className="sub-features">
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <button
                className={`sub-cta ${p.highlight ? 'primary' : ''}`}
                disabled={currentPlanId === p.id}
                onClick={() => onSelectPlan(p.id, period)}
              >
                {currentPlanId === p.id ? 'Current plan' : p.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="sub-footnote">Secure payment by Stripe. Invoices available.</p>
      </div>
    </div>
  );
}
