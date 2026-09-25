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

Creator data is Launchly's own — collected from public TikTok profile
pages (see "Creator data source" below), not a third-party analytics API.

### 1. Supabase

Run the migrations in the Supabase SQL editor, in order:

```sql
-- Paste contents of supabase/migrations/002_create_creator_api_tables.sql
-- Paste contents of supabase/migrations/003_create_creator_api_cache.sql (now unused by search, harmless to keep)
-- Paste contents of supabase/migrations/004_create_creator_data_tables.sql
```

Adds `api_subscriptions`, `api_keys`, `api_usage_events`, and Launchly's
own creator-data tables: `creators`, `creator_videos`, `creator_snapshots`.

### 2. Search Creator API Stripe Price — manual step required

1. In Stripe create: `Launchly Search Creator API`
2. Price: `£5.00 GBP`
3. Billing: Monthly recurring
4. Copy the Stripe Price ID: `price_...`
5. From the `worker` folder run:
   ```bash
   npx wrangler secret put CREATOR_API_PRICE_ID
   ```
6. Paste the full `price_...` value when prompted.
7. Deploy:
   ```bash
   npx wrangler deploy
   ```

This must be a **separate** product from `STRIPE_PRICE_ID` (the main
Launchly app subscription) — do not reuse it. The checkout route
(`worker/src/creatorApiSubscription.ts`) reads only `env.CREATOR_API_PRICE_ID`
and never falls back to `STRIPE_PRICE_ID` or any hardcoded value; if the
variable is missing, checkout refuses with a `CREATOR_API_PRICE_NOT_CONFIGURED`
error instead of guessing a price.

No other new secrets are needed for Search Creator API billing — this
reuses `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`.

Optional, for real per-key rate limiting on `GET /api/v1/creators/search`
(60 req/min/key; the endpoint works without it, just without that check):

```bash
wrangler kv:namespace create API_RATE_LIMIT
# then add the printed [[kv_namespaces]] block to wrangler.toml
```

### Creator data source

No API key, no third-party account, nothing to configure. Real creator
data comes from `worker/src/tiktokPublicCollector.ts`, which fetches a
creator's own public TikTok profile page (the same page a signed-out
browser sees) and reads the JSON TikTok's server embeds in it to render
that page. No login, no cookies, no private/undocumented endpoints — if a
profile is public, the same data is there for the taking; if it isn't,
there's nothing to read and the search returns `CREATOR_NOT_FOUND`.

Because that page's structure is TikTok's own implementation detail, not
a published contract, it can change without notice. `parseEmbeddedState()`
and `parseOpenGraphProfile()` in that file are kept as pure, independently
testable functions specifically so they're easy to re-verify/patch against
a fresh page sample without touching auth, billing, caching, or the rest
of the pipeline. See `worker/src/*.test.ts` for the fixture-based tests —
they don't require live network access, unlike the collector itself.

Collected fields (`followers`, `following`, `likes`, `videoCount`, recent
`views`/`likes`/`comments`/`shares`/`publishedAt` per video) are what
TikTok's public page reports directly. `avgViews`, `avgLikes`,
`avgComments`, `engagementRate` and `postingFrequencyPerWeek` are
Launchly's own calculations from those collected videos
(`worker/src/creatorMetrics.ts`) — not TikTok-provided numbers. Anything
not reliably available (e.g. the creator's own region) is `null`, never
guessed. GMV/items-sold/product data does not exist in this version — see
`worker/src/creatorApiDebug.ts` and the Developer settings card for the
current field set; TikTok Shop commerce data is a planned future phase,
not implemented.

### APIs

```
GET /api/v1/creators/search?q=<username>
Authorization: Bearer lch_live_...
```
The external, Bearer-API-key gateway — for a subscriber's own backend.
Keys are created from Settings → Developer, and only work while the
Search Creator API subscription is active. `q` accepts `username`,
`@username`, or a full `https://www.tiktok.com/@username` URL.

```
GET /api/creator-api/search?q=<username>
Authorization: Bearer <Supabase access token>
```
The in-app search used from Settings → Developer's own search box —
session-authenticated instead of an API key. Both routes call the same
`worker/src/creatorSearchService.ts` → `worker/src/tiktokPublicCollector.ts`
pipeline, so there is exactly one creator dataset and one collector, never
two implementations to keep in sync.

`hasCreatorApiAccess(env, userId)` in `creatorApiSubscription.ts` is the one
place that decides whether a user's Search Creator API subscription is
currently valid — every route above calls it rather than re-implementing
the check.
