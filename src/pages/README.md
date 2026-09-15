# Pages

One folder per page, named the way the app names it. Everything a page renders
lives beside it; anything shared by more than one page stays outside this folder
(`src/ui`, `src/services`, `src/lib`, `src/store.ts`, `src/useSubscription.ts`).

| Folder | Route | What it is |
| --- | --- | --- |
| `get-in/` | `/get-in`, `/signup` | Logging in and signing up |
| `paywall/` | `/paywall` | The scenic gate for an unpaid visitor, the manage view for a subscriber, and the return from Stripe |
| `inside/` | `/inside` | The workspace itself: the generator, its pickers, the settings panel, the ambient backdrop |
| `bots/` | `/bots` | Analysis agents pointed at a TikTok account — a UI prototype running on locally generated demo data |

`/pricing` and `/dashboard` are the old names. They still work, and the app
rewrites them to `/paywall` and `/inside` in the address bar.

Paying at the Paywall sends you Inside: the page polls until Stripe's webhook
lands, then navigates to `/inside` without a reload.

`src/App.tsx` only routes between these four, and sets each page's title.

`bots/` is a prototype: its numbers come from `bots/demo-data.ts`, not from
TikTok, and it performs no automation against the platform — the agents read and
suggest, and every draft reply is left for a person to send.
