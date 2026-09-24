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

## Search Creator API (paid, external)

A second, independent product on the same Stripe account and the same
worker/webhook — not a separate Stripe or billing system. Settings →
Developer → API Access & Billing manages it.

### 1. Supabase

Run the migrations in the Supabase SQL editor, in order:

```sql
-- Paste contents of supabase/migrations/002_create_creator_api_tables.sql
-- Paste contents of supabase/migrations/003_create_creator_api_cache.sql
```

Adds `api_subscriptions`, `api_keys`, `api_usage_events`, `creator_api_cache`.

### 2. Stripe — manual step required

Create a **second** product (do not reuse `STRIPE_PRICE_ID`):

- Product name: `Launchly Search Creator API`
- Price: `£5.00 GBP`, recurring **monthly**

Copy the resulting **Price ID** (`price_...`).

### 3. Kalodata (upstream creator data) — manual step required

Create/locate a Kalodata API key with access to creator search.

### 4. Cloudflare Worker

```bash
wrangler var put CREATOR_API_PRICE_ID=price_xxx
wrangler secret put KALODATA_API_KEY
# paste the real key at the prompt — never in a file, chat, or commit
```

No other new secrets are needed — this reuses `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Optional, for real per-key rate limiting on `GET /api/v1/creators/search`
(60 req/min/key; the endpoint works without it, just without that check):

```bash
wrangler kv:namespace create API_RATE_LIMIT
# then add the printed [[kv_namespaces]] block to wrangler.toml
```

### APIs

```
GET /api/v1/creators/search?q=<username>&region=<GB>
Authorization: Bearer lch_live_...
```
The external, Bearer-API-key gateway — for a subscriber's own backend.
Keys are created from Settings → Developer, and only work while the
Search Creator API subscription is active.

```
GET /api/creator-api/search?q=<username>&region=<GB>
Authorization: Bearer <Supabase access token>
```
The in-app search used from Settings → Developer's own search box —
session-authenticated instead of an API key. Both routes call the same
`worker/src/creatorSearchService.ts` → `worker/src/kalodataClient.ts`, so
there is exactly one search implementation and one cache
(`creator_api_cache`, 6h TTL) in front of the real Kalodata upstream.

`hasCreatorApiAccess(env, userId)` in `creatorApiSubscription.ts` is the one
place that decides whether a user's Search Creator API subscription is
currently valid — every route above calls it rather than re-implementing
the check.
