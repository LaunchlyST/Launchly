# Pages

One folder per page. Everything a page renders lives beside it; anything shared
by more than one page stays outside this folder (`src/ui`, `src/services`,
`src/lib`, `src/store.ts`, `src/useSubscription.ts`).

| Folder | Route | What's in it |
| --- | --- | --- |
| `get-in/` | `/`, `/signup` | Login and sign-up forms |
| `dashboard/` | `/dashboard` (paid) | The generator, its pickers, the settings panel, the ambient backdrop |
| `pricing/` | `/pricing` | Post-checkout handling; picks the gate or the manage view |
| `paywall/` | the unpaid gate on both `/dashboard` and `/pricing` | The scenic scene (`DashboardPaywall`, `CoastalScene`, `FeedbackMenu`, `plans.ts`, `landscape.ts`) and the older `Paywall` stack used for the verifying, unlocking and active-subscriber states |

`src/App.tsx` only routes between them.
