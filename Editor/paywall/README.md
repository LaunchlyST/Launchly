# Paywall — ACCESS

**Decides what the user can use.** It never takes money.

The sibling folder `../subscription` handles the money. These two only meet at
one place: the `Subscription` record. The paywall **reads** it; it never writes
it, never calls Stripe, and never triggers a charge.

```
subscription record  ──read──▶  access/accessRules  ──▶  gate/featureGate
   (written by                   (pure functions)          usePaywall
    the money side)                                        components
```

## Folders

| Folder | Holds |
|---|---|
| `config/plans.ts` | **The one place plans are defined** — features, limits, prices, Stripe Price IDs |
| `types/` | `plan.types.ts` (what a plan is), `access.types.ts` (what the paywall answers) |
| `plans/` | Plan lookup, upgrade/downgrade comparison, "cheapest plan that unlocks X" |
| `access/` | `accessRules.ts` — the rules (pure functions) |
| `gate/` | `featureGate.ts` — the one-line check call sites use |
| `hooks/` | `usePaywall.ts` — what feature code actually calls |
| `components/` | `PricingPage`, `PlanCard`, `PaywallModal`, `LockedFeature` |
| `styles/` | `paywall.css` — pricing, plan cards, modal, locked controls |

## Rules

1. `access/accessRules.ts` is **pure** — no Stripe, no `fetch`, no React. That is
   why access can be reasoned about and tested on its own.
2. **Change a plan in `config/plans.ts` only.** Never hard-code a feature or a
   limit anywhere else in the app.
3. A **lapsed subscription falls back to Free automatically**
   (`effectivePlanId`), so no cleanup job is needed when one expires.
4. A **cancelled** subscription keeps its plan until `currentPeriodEnd` — the
   user paid for that time.
5. Blocking returns an `AccessDecision`. The **UI** decides whether to show the
   upgrade prompt; the paywall never starts checkout itself.

## Using it

```tsx
const { canUse, requireFeature, requireAllowance, prompt, dismissPrompt } = usePaywall();

requireFeature('export.4k', () => startExport());         // blocked → prompt
requireAllowance('exportsPerMonth', () => startExport()); // also counts usage

<PaywallModal prompt={prompt} onClose={dismissPrompt} />
<LockedFeature feature="ai.premiumModels"><ModelPicker /></LockedFeature>
```

## Not wired up yet

Nothing in the editor imports this folder — it does not affect the running app.
