# Subscription Backend

Stripe + Supabase + Cloudflare Worker subscription system.

## Structure

```
subscription-backend/
├── supabase/
│   └── migrations/
│       └── 001_create_users_table.sql   # Users table + RLS policies
├── worker/
│   ├── src/
│   │   └── index.ts                     # Cloudflare Worker (checkout + webhooks)
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
└── react/
    ├── hooks/
    │   └── useSubscription.ts           # React hook for subscription state
    ├── components/
    │   └── SubscriptionGate.tsx          # Hides editor if inactive
    └── index.ts                         # Barrel exports
```

## Setup

### 1. Supabase

Run the migration in the Supabase SQL editor:

```sql
-- Paste contents of supabase/migrations/001_create_users_table.sql
```

### 2. Stripe

1. Create a product: "Launchly Pro" — £5/month recurring
2. Copy the **Signing Secret** from Stripe Webhooks (endpoint: `https://your-worker.workers.dev/api/webhook`)
3. Copy your **Secret Key**

### 3. Cloudflare Worker

```bash
cd worker
npm install

# Set secrets
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Update FRONTEND_URL in wrangler.toml

# Deploy
wrangler deploy
```

### 4. React Frontend

Add to your `.env`:

```
VITE_WORKER_URL=https://your-worker.workers.dev
```

Usage in your app:

```tsx
import { SubscriptionGate } from "./subscription-backend/react";

// Wrap your editor
<SubscriptionGate userId={user?.id} userEmail={user?.email}>
  <YourEditor />
</SubscriptionGate>
```

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set subscription active |
| `customer.subscription.updated` | Sync status (active/past_due/cancelled) |
| `customer.subscription.deleted` | Mark cancelled |
| `invoice.payment_failed` | Mark past_due |
