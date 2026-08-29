# Subscription — MONEY

**Handles Stripe and the money.** It never decides what a user can access.

The sibling folder `../paywall` handles access. These two only meet at one
place: the `Subscription` record. This folder **writes** it; the paywall reads
it.

```
User picks a plan
  └─ payments/checkoutService      → Stripe Checkout          MONEY
       └─ Stripe collects the payment
            └─ webhooks/stripeWebhookHandler.server            MONEY (server only)
                 └─ writes the Subscription record  ◀── the handover
                      └─ services/subscriptionService reads it
                           └─ ../paywall resolves access       ACCESS
```

## Folders

| Folder | Holds |
|---|---|
| `config/stripeConfig.ts` | Publishable key, API base, backend routes — **never the secret key** |
| `types/subscription.types.ts` | The record: plan, status, Stripe ids, period end |
| `stripe/` | `stripeClient.ts` — the only module that calls the billing backend |
| `payments/` | `checkoutService.ts` (start a subscription), `paymentStatus.ts` (Stripe's vocabulary → ours) |
| `webhooks/` | The events we handle, and the **server-side** handler that records them |
| `services/` | `subscriptionService.ts` — reads the record, fails safe to Free |
| `usage/` | `usagePeriod.ts` — allowance counters, reset by the billing period |
| `billing/` | `billingPortal.ts` — Stripe's hosted portal for card, invoices, cancel |
| `hooks/` | `useSubscription.ts` — the store holding the record + usage |
| `components/` | `CurrentPlanPanel` — plan, status, renewal, usage meters |
| `styles/` | `billing.css` |

## Rules

1. **The secret key never enters this folder.** Checkout sessions and webhook
   verification belong on a server.
2. This folder may read the paywall's **plan config, types and lookups** — but
   never its `access/`, `gate/`, `hooks/` or `components/`. Decisions flow one
   way: `paywall → subscription`, never back. (`CurrentPlanPanel` therefore
   takes the access snapshot as a **prop** rather than calling `usePaywall`.)
3. `stripeWebhookHandler.server.ts` is server-only (hence the suffix). Verify the
   signature against the **raw** request body before calling it, and keep it
   idempotent — Stripe delivers at-least-once.
4. Cancelling does **not** revoke access immediately; Stripe sets
   `cancel_at_period_end` and the paywall honours the paid period.
5. `fetchSubscription` fails safe to Free — a billing outage must never hand out
   paid access, nor lock someone out of the free tier.

## Before this can take real payments

- [ ] Build the backend: the three routes in `config/stripeConfig.ts`
- [ ] Set `VITE_STRIPE_PUBLISHABLE_KEY` and `VITE_API_BASE_URL`
- [ ] Replace `price_REPLACE_ME_*` in `../paywall/config/plans.ts` with real Price IDs
- [ ] Move `webhooks/stripeWebhookHandler.server.ts` into the backend and register the endpoint

## Not wired up yet

Nothing in the editor imports this folder — it does not affect the running app.
