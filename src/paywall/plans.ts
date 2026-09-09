/**
 * What the three cards say.
 *
 * Everything here is grounded in what the app and the subscription worker
 * actually do today:
 *
 *  - The worker (subscription-backend/worker/src/index.ts) creates a Checkout
 *    Session against ONE price, STRIPE_PRICE_ID — the "Launchly Pro" £5/month
 *    product described in subscription-backend/README.md. That is the only
 *    thing that can be bought, so it is the only card with a checkout action.
 *  - Generation runs on the user's own OpenAI / xAI keys, held in the browser
 *    (src/store.ts, src/settings/SettingsPanel.tsx). Launchly does not include
 *    generation credits, so no card claims any.
 *  - There is no price, product or entitlement configured for an affiliate
 *    tier anywhere in the repo. Its card therefore states that plainly and
 *    cannot start a checkout, rather than sending someone to the £5 price
 *    under another name.
 */

export type PlanAction = 'current' | 'checkout' | 'unavailable';

export interface Plan {
  id: string;
  name: string;
  note: string;
  price: string;
  period?: string;
  features: string[];
  action: PlanAction;
  fine: string;
  featured?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    note: 'What an account gives you before you subscribe.',
    price: '£0',
    features: [
      'A Launchly account',
      'Save your OpenAI and xAI keys in this browser',
      'Keys stay on your device — never sent to Launchly',
    ],
    action: 'current',
    fine: 'Generating images and video needs Model Access.',
  },
  {
    id: 'model-access',
    name: 'Model Access',
    note: 'The workspace, running on the models you already pay for.',
    price: '£5',
    period: '/ month',
    features: [
      'ChatGPT (OpenAI) and Grok (xAI) in one workspace',
      'Product images and short video from one prompt',
      'Realistic and cartoon style presets',
      'Cancel anytime — billed by Stripe',
    ],
    action: 'checkout',
    fine: 'Runs on your own API keys. OpenAI and xAI bill you for generation separately.',
    featured: true,
  },
  {
    id: 'affiliate-toolkit',
    name: 'Affiliate Toolkit',
    note: 'Planned tooling for TikTok Shop affiliates.',
    price: 'Not priced',
    features: [
      'No product or price is configured for this tier yet',
      'Nothing in the app is gated behind it today',
      'It will be listed here once it actually exists',
    ],
    action: 'unavailable',
    fine: 'Checkout is disabled so nobody is charged for something that is not built.',
  },
];
