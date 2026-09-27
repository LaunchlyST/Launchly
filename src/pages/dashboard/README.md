# Launchly Creator API frontend

The dashboard section and browser page title are **Search Creator API**.
The product is **Launchly Creator API** at £5/month.

The frontend calls `/api/launchly/creators/search` through `VITE_WORKER_URL` with a
Supabase bearer token. It uses the Launchly-only schema in `shared/creator-contract.ts`.
Credentials, caching, subscription verification and external data calls remain on the Worker.

The input accepts usernames, @usernames and TikTok profile URLs. UK is the default.
The single period selector offers 7 days through 1 year. Longer searches require an
exact handle. Unavailable metrics remain absent; no sample analytics are displayed.

The existing theme, sorting, supported filters, saved creators, CSV export and detail
pages are retained. User-facing API credits and external cost information are not shown.

See [API contract and setup](../../../subscription-backend/CREATOR-API.md).
