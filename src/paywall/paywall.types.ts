export type PaywallFeature = 'export' | 'hd_export' | 'ai_tools' | 'premium_timeline' | 'unlimited_projects';

export interface PaywallState {
  isPro: boolean;
  triggeredFeature: PaywallFeature | null;
  showPaywall: boolean;
}

export interface PaywallPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}
