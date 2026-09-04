export interface SubscriptionInfo {
  id: string;
  name: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  features: string[];
  isActive: boolean;
}
