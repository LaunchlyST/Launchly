# Launchly Creator API

The page title is **Search Creator API**. The API/product name is **Launchly Creator API**.
The product is £5/month, with unlimited creator username searches and real TikTok Shop
creator analytics. Missing measurements stay null. There is no runtime demo fallback.

## Public routes

All routes use the existing Launchly Worker origin (`VITE_WORKER_URL`). The browser
sends a Supabase access token in its Authorization header. An active, unexpired,
verified £5 GBP monthly subscription is required before cache or data access.

| Method | Route |
| --- | --- |
| GET | `/api/launchly/creators/search?q=username&region=GB` |
| GET | `/api/launchly/creators/:creatorId` |
| GET | `/api/launchly/creators/:creatorId/products` |
| GET | `/api/launchly/creators/:creatorId/videos` |
| GET | `/api/launchly/creators/status` |

Search accepts a username, @username or TikTok profile URL. The client and server
trim whitespace, strip leading @, parse profile URLs and normalize lowercase.
Defaults: region GB, period 30 days, page 1, pageSize 20. Supported page sizes are
5–100 and pages 1–5. A full page can indicate another page may exist; no total is
invented. The market selector lists the 15 supported markets with matching currency.

The period dropdown offers 7, 30, 90, 180 and 365 days. Periods above 30 days require
an exact username and return its actual period analytics. Product/video lists support
7 and 30 days only; longer windows never silently substitute 30-day data.

## Response contract

`shared/creator-contract.ts` exports `LaunchlyCreator` and
`LaunchlyCreatorSearchResponse`. Each creator has `id`, `username`, `displayName`,
`avatar`, `region`, `followers`, `likes`, `videoCount`, `gmv`, `itemsSold` and
`productCount`. Additional Launchly fields include requested currency, content views
and channel revenue. Unsupported values are null; no synthetic numbers are used.

Empty search example:

```json
{
  "success": true,
  "service": "Launchly Creator API",
  "data": {
    "creators": [],
    "pagination": { "page": 1, "pageSize": 20, "hasMore": false }
  }
}
```

Errors:

```json
{
  "success": false,
  "service": "Launchly Creator API",
  "error": {
    "code": "UPSTREAM_ERROR",
    "message": "Unable to load creator data. Please try again."
  }
}
```

Status when configured and cache storage is accessible:

```json
{ "success": true, "service": "Launchly Creator API", "status": "online" }
```

Status does not make a paid data request. It does not expose credentials, account
information, credits or implementation details. Missing configuration/cache returns
503 with offline status. Unauthorized/unsubscribed requests return 401/403.

## Internal implementation

`worker/src/services/creator-provider.ts` is the private backend adapter. It performs
all external requests and maps responses through `normalizeCreator()` and the other
normalizers. It is never imported into the browser. The frontend calls only Launchly
routes and accepts only Launchly fields. Public errors use controlled messages rather
than forwarding raw external messages. Private adapter comments retain the source
contract references needed for maintenance.

`creator_api_cache` contains only normalized JSON, with a versioned cache key including
market, currency, period, query/ID and pagination. Search/profile TTL is six hours;
products/videos use three hours. Temporary failures may serve data expired less than
24 hours ago, marked stale. Authentication and plan checks always precede cache reads.
Internal distributed request controls remain server-side. Public pricing never shows
request costs or API credits. The Creator Search page hides the generation credit widget;
unrelated generation settings keep their existing behavior.

Signed media and undocumented dated-series schemas are not exposed. Missing images,
charts and metrics remain placeholders. Product/video lists currently show up to 20
results in the analytics UI. The API supports additional pages. No live end-to-end
creator response has been verified without the required backend configuration.

## Deployment setup (backend maintainers)

Apply migrations 002 and 003 to the existing Supabase project after migration 001.
Migration 002 secures billing writes and creates the cache/limiter. Migration 003 adds
`subscription_price_id` and `creator_api_plan_verified`, writable only server-side.
Existing subscribers need a verified Stripe subscription-update event replay to fill
these fields; do not mark old active rows as verified without checking their Stripe plan.

Configure backend-only secrets:

```powershell
npx wrangler secret put CREATOR_DATA_API_KEY --config subscription-backend/worker/wrangler.toml
npx wrangler secret put SUPABASE_URL --config subscription-backend/worker/wrangler.toml
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config subscription-backend/worker/wrangler.toml
```

Keep the existing Stripe secrets. `STRIPE_PRICE_ID` must reference the Launchly Creator
API price: 500 GBP minor units, recurring every one month, licensed usage, quantity one.
Checkout validates this price; signed Stripe webhooks populate plan verification.
The API checks the stored verified price ID and current paid status on every request.
The billing implementation follows the [Stripe price schema](https://docs.stripe.com/api/prices/object).

Do not put backend secrets in VITE variables, browser storage or source control. The
private adapter accepts the previous backend secret name for compatibility, but new
configuration should use the generic name above. Safe logs mention configuration
names/statuses only. Set CREATOR_DEBUG=true on the Worker for safe diagnostics.

After setup, deploy the Worker and publish the frontend through its existing workflow:

```powershell
npx wrangler deploy --config subscription-backend/worker/wrangler.toml
```

No production deployment, payment creation or live database migration was performed
by this change. Live verification requires configuration and an eligible signed-in
account. Verify one real search/profile and then a cache hit.

## Checks

```powershell
node --test tests/creator-api.test.mjs tests/creator-worker.test.mjs tests/creator-cache.test.mjs
npx tsc --noEmit
npx tsc --noEmit -p subscription-backend/worker/tsconfig.json
npm run build
npx wrangler deploy --dry-run --config subscription-backend/worker/wrangler.toml
```

Tests use isolated fixtures only. They cover public route/schema naming, authorization,
paid-plan matching, signed webhook verification, cache isolation and fallback, missing
configuration, normalized inputs, number formatting and private SQL permissions.
PGlite runs the actual cache and plan migrations in an isolated PostgreSQL runtime.
