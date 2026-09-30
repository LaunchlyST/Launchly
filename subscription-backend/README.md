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

1. Create a product: "Launchly Creator API" — £5/month recurring
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

## Monitor — projects & AI providers

Routes under `/api/monitor/*` (worker/src/monitor/monitorRoutes.ts), all require a signed-in user:
`GET status`, `GET models`, `GET providers`, `POST providers/:p/test`, `POST providers/:p`,
`DELETE providers/:p`. GitHub OAuth and repository selection are implemented.
Git-URL import, Monitor Bridge and the project execution agent remain unavailable.

Setup:
- Run `supabase/migrations/005_create_monitor_provider_keys.sql`.
- `npx wrangler secret put MONITOR_ENCRYPTION_KEY` — base64 of 32 random bytes
  (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
- Optional `MONITOR_LATEST_MODELS` JSON to move what "Latest" means per provider.

### Monitor GitHub connection

1. Apply migrations `006_monitor_projects.sql` and `007_monitor_github.sql` after migration 005.
2. Register a GitHub OAuth app. Set its callback URL to
   `http://127.0.0.1:5173/dashboard?section=monitor&github=connect` for local development.
   For production use the production frontend origin with the same path and query.
3. Set worker secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and
   `MONITOR_ENCRYPTION_KEY`. Set `MONITOR_GITHUB_REDIRECT_URI` to the exact callback
   URL above (use a separate OAuth app for each environment). Never put these secrets
   in frontend VITE variables. For local Wrangler, use an ignored `.dev.vars` file.
4. Start the backend with `npm run dev` from `subscription-backend/worker`.
   The local frontend uses port 8787 by default. Deploy backend changes for production.

The user opens Connect a project, approves GitHub access, then returns to a searchable
repository picker and selects a branch. Existing GitHub connections go directly to
the picker. OAuth uses user-bound, single-use state with a ten-minute expiry and PKCE;
GitHub tokens are encrypted and never returned to the browser. The OAuth `repo` scope
allows access to private repositories as well as public ones; GitHub presents that grant.
See [GitHub's OAuth flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

Repository selection is saved pending workspace provisioning (`syncing`). It does not
clone a workspace or start an agent. Coding remains disabled until a real execution
service provisions the workspace, marks it synced, and implements the agent endpoints.
