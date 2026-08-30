export type BillingPeriod = 'monthly' | 'yearly';
export type PlanId = 'free' | 'pro' | 'team';

export interface Plan {
  id: PlanId;
  name: string;
  price: Record<BillingPeriod, string>;
  periodLabel: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  badge?: string;
}

export interface SubscriptionState {
  planId: PlanId;
  period: BillingPeriod;
  status: 'active' | 'trialing' | 'canceled' | 'past_due';
  renewsAt?: string;
}
