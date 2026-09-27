import type Stripe from 'stripe';

export function isLaunchlyCreatorPrice(price: Stripe.Price, expectedId: string): boolean {
  return !!expectedId && price.id === expectedId && price.currency === 'gbp' && price.unit_amount === 500 &&
    price.type === 'recurring' && price.recurring?.interval === 'month' &&
    price.recurring.interval_count === 1 && price.recurring.usage_type === 'licensed';
}

export function creatorPlanFields(subscription: Stripe.Subscription, expectedId: string) {
  const item = subscription.items.data[0];
  return {
    subscription_price_id: item?.price.id ?? null,
    creator_api_plan_verified: subscription.items.data.length === 1 && item?.quantity === 1 &&
      isLaunchlyCreatorPrice(item.price, expectedId),
  };
}

export function hasLaunchlyCreatorPlan(row: {
  subscription_status?: string; subscription_current_period_end?: string | null;
  subscription_price_id?: string | null; creator_api_plan_verified?: boolean;
} | null, expectedId: string) {
  return !!expectedId && row?.subscription_status === 'active' && row.creator_api_plan_verified === true &&
    row.subscription_price_id === expectedId && Date.parse(row.subscription_current_period_end || '') > Date.now();
}
