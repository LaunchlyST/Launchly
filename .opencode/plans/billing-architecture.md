# Billing Architecture — Implementation Plan

## Goal
Build a complete billing architecture (plans, checkout, subscriptions, invoices, coupons, credits, usage, feature permissions, upgrades, downgrades, payment history) without connecting Stripe. Architecture only.

---

## Architecture

```
editor-engine/billing/
  plans.js               ← plan tier definitions and limits
  checkout.js            ← checkout session creation and management
  subscriptions.js       ← subscription lifecycle (create, upgrade, downgrade, cancel)
  invoices.js            ← invoice generation and payment history
  coupons.js             ← coupon validation and discount application
  credits.js             ← credit balance and usage
  usage.js               ← usage tracking per feature
  featurePermissions.js  ← feature access control based on plan
  billingEngine.js       ← central orchestrator (state factory, all billing methods)
```

### Flow

```
EditorCore.useFeature(featureKey)
  → billingEngine.canAccessFeature(state, featureKey)
    → featurePermissions.check(plan, feature)
      → plans.getTierLimits(plan) → { allowed: true/false }

EditorCore.upgradePlan(newPlanId)
  → billingEngine.processUpgrade(state, newPlanId)
    → subscriptions.upgrade(state.subscription, newPlanId)
      → invoices.generateUpgradeInvoice(state)
        → credits.applyCreditBalance(state)
```

---

## File-by-File Plan

### 1. `editor-engine/billing/plans.js`

Defines plan tiers, pricing, and per-tier feature limits.

```js
export const PLAN_TIERS = Object.freeze({
  free: {
    id: "free",
    name: "Free",
    description: "Get started with core editing features.",
    pricing: { monthly: 0, yearly: 0, currency: "usd" },
    limits: {
      exportsPerMonth: 5,
      exportResolution: "1080p",
      exportDuration: 120,          // max seconds
      storageGB: 1,
      aiToolRunsPerDay: 10,
      aiToolCategories: ["captions", "analysis"],
      tracks: 4,
      transitions: "basic",         // "basic" | "all"
      effects: "standard",          // "standard" | "premium"
      textTemplates: "basic",
      colorGrading: false,
      voiceEnhancement: false,
      backgroundRemoval: false,
      autoReframe: false,
      collaboration: false,
      priorityRender: false,
      customExportPresets: false,
      pluginInstall: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Full editing power for serious creators.",
    pricing: { monthly: 2400, yearly: 22800, currency: "usd" }, // cents
    limits: {
      exportsPerMonth: 100,
      exportResolution: "4K",
      exportDuration: 600,
      storageGB: 50,
      aiToolRunsPerDay: 200,
      aiToolCategories: ["captions", "analysis", "audio", "copy", "creative"],
      tracks: 24,
      transitions: "all",
      effects: "premium",
      textTemplates: "all",
      colorGrading: true,
      voiceEnhancement: true,
      backgroundRemoval: true,
      autoReframe: true,
      collaboration: false,
      priorityRender: true,
      customExportPresets: true,
      pluginInstall: true,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Unlimited power for teams and studios.",
    pricing: { monthly: 7900, yearly: 75600, currency: "usd" },
    limits: {
      exportsPerMonth: -1,          // -1 = unlimited
      exportResolution: "4K",
      exportDuration: -1,
      storageGB: 500,
      aiToolRunsPerDay: -1,
      aiToolCategories: ["captions", "analysis", "audio", "copy", "creative", "advanced"],
      tracks: -1,
      transitions: "all",
      effects: "premium",
      textTemplates: "all",
      colorGrading: true,
      voiceEnhancement: true,
      backgroundRemoval: true,
      autoReframe: true,
      collaboration: true,
      priorityRender: true,
      customExportPresets: true,
      pluginInstall: true,
    },
  },
});

export function getTierLimits(planId) { ... }
export function getTierPricing(planId, interval = "monthly") { ... }
export function formatPrice(cents) { ... }  // "$24.00"
export function isUnlimited(value) { return value === -1; }
```

### 2. `editor-engine/billing/checkout.js`

Manages checkout sessions (simulated — no Stripe redirect).

```js
export function createCheckoutSession(state, options) {
  // options: { planId, interval, couponCode?, successUrl?, cancelUrl? }
  // Returns a checkout session object with status, session id, pricing breakdown
  return {
    id: createId("checkout"),
    planId: options.planId,
    interval: options.interval ?? "monthly",
    couponCode: options.couponCode ?? null,
    subtotal: getTierPricing(options.planId, options.interval),
    discount: 0,         // calculated if coupon valid
    total: 0,            // subtotal - discount + tax
    tax: 0,
    status: "pending",   // "pending" | "processing" | "completed" | "failed" | "abandoned"
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function validateCheckoutSession(session) { ... }
export function completeCheckoutSession(session) { ... }  // sets status: "completed"
export function abandonCheckoutSession(session) { ... }    // sets status: "abandoned"
```

### 3. `editor-engine/billing/subscriptions.js`

Subscription lifecycle management.

```js
export function createSubscription(state, checkoutSession) {
  return {
    id: createId("sub"),
    planId: checkoutSession.planId,
    interval: checkoutSession.interval,
    status: "active",    // "active" | "past_due" | "canceled" | "trialing" | "paused"
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: /* calculated from interval */,
    cancelAtPeriodEnd: false,
    trialEnd: null,       // ISO string if on trial
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function upgradeSubscription(subscription, newPlanId, interval) { ... }
export function downgradeSubscription(subscription, newPlanId, interval) { ... }
export function cancelSubscription(subscription, immediate = false) { ... }
export function pauseSubscription(subscription) { ... }
export function resumeSubscription(subscription) { ... }
export function isSubscriptionActive(subscription) { ... }
export function getSubscriptionTier(subscription) { ... }
export function daysUntilRenewal(subscription) { ... }
```

### 4. `editor-engine/billing/invoices.js`

Invoice generation and payment history.

```js
export function generateInvoice(state, options) {
  return {
    id: createId("inv"),
    number: `INV-${Date.now().toString(36).toUpperCase()}`,
    subscriptionId: options.subscriptionId ?? null,
    planId: options.planId,
    amount: options.amount,             // cents
    currency: "usd",
    status: "paid",                     // "paid" | "pending" | "failed" | "refunded"
    description: options.description ?? "",
    lineItems: options.lineItems ?? [], // [{ description, amount }]
    discount: options.discount ?? 0,
    tax: options.tax ?? 0,
    total: options.amount - (options.discount ?? 0) + (options.tax ?? 0),
    billingEmail: options.billingEmail ?? "",
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
  };
}

export function getPaymentHistory(invoices, options = {}) {
  // options: { limit, offset, status, planId, dateRange }
  return invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function generateUpgradeInvoice(state, oldPlanId, newPlanId, interval) { ... }
export function generateDowngradeCredit(state, oldPlanId, newPlanId) { ... }
```

### 5. `editor-engine/billing/coupons.js`

Coupon validation and discount calculation.

```js
export const COUPON_PRESETS = Object.freeze([
  { id: "LAUNCH50", name: "Launch Discount", type: "percent", value: 50, maxUses: 1000, usedCount: 0, expiresAt: "2026-12-31T23:59:59Z", validPlans: ["pro", "enterprise"], validIntervals: ["monthly", "yearly"] },
  { id: "ANNUAL20", name: "Annual Savings", type: "percent", value: 20, maxUses: -1, usedCount: 0, expiresAt: null, validPlans: ["pro", "enterprise"], validIntervals: ["yearly"] },
  { id: "WELCOME10", name: "Welcome Offer", type: "fixed", value: 1000, maxUses: -1, usedCount: 0, expiresAt: null, validPlans: ["pro", "enterprise"], validIntervals: ["monthly", "yearly"] },
]);

export function validateCoupon(couponCode, planId, interval, coupons = COUPON_PRESETS) {
  // Returns { valid, coupon, error }
}

export function calculateDiscount(subtotal, coupon) {
  // Returns discount amount in cents
}

export function applyCoupon(subtotal, coupon) {
  // Returns { subtotal, discount, total }
}
```

### 6. `editor-engine/billing/credits.js`

Credit balance management.

```js
export function createCreditAccount() {
  return {
    id: createId("credits"),
    balance: 0,              // cents
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    transactions: [],        // [{ id, amount, type, description, createdAt }]
    createdAt: new Date().toISOString(),
  };
}

export function addCredits(account, amount, description) { ... }
export function spendCredits(account, amount, description) { ... }
export function getCreditBalance(account) { ... }
export function applyCreditBalance(account, amount) {
  // Applies as much credit as possible, returns { applied, remaining }
}
```

### 7. `editor-engine/billing/usage.js`

Usage tracking per feature per billing period.

```js
export function createUsageTracker() {
  return {
    periodStart: new Date().toISOString(),
    periodEnd: /* +30 days */,
    counters: {
      exports: 0,
      aiToolRuns: 0,
      storageBytes: 0,
    },
    history: [],  // [{ feature, amount, timestamp }]
  };
}

export function trackUsage(tracker, feature, amount = 1) { ... }
export function getUsage(tracker, feature) { ... }
export function getUsagePercentage(tracker, feature, limit) {
  // Returns 0-1 (or null if unlimited)
}
export function resetUsage(tracker) { ... }  // new billing period
export function isOverLimit(tracker, feature, limit) { ... }
```

### 8. `editor-engine/billing/featurePermissions.js`

Feature access control based on plan.

```js
export const FEATURE_KEYS = Object.freeze([
  "export", "transitions", "effects", "textTemplates", "colorGrading",
  "voiceEnhancement", "backgroundRemoval", "autoReframe", "aiTools",
  "collaboration", "priorityRender", "customExportPresets", "pluginInstall",
  "tracks", "storage", "exportResolution", "exportDuration",
]);

export function canAccessFeature(planId, featureKey, limits) {
  const limit = limits[featureKey];
  if (limit === undefined) return true;
  if (limit === false) return false;
  if (limit === true) return true;
  if (typeof limit === "number") return limit !== 0;
  if (typeof limit === "string") return limit !== "none";
  return true;
}

export function getRestrictedFeatures(planId, allFeatures, limits) {
  return allFeatures.filter((f) => !canAccessFeature(planId, f, limits));
}

export function getUpgradeHints(planId, featureKey) {
  // Returns which plan unlocks this feature
}
```

### 9. `editor-engine/billing/billingEngine.js`

Central orchestrator. State factory and all billing methods exposed to EditorCore.

```js
import { PLAN_TIERS, getTierLimits, getTierPricing } from "./plans.js";
import { createCheckoutSession, completeCheckoutSession } from "./checkout.js";
import { createSubscription, upgradeSubscription, downgradeSubscription, cancelSubscription } from "./subscriptions.js";
import { generateInvoice, generateUpgradeInvoice } from "./invoices.js";
import { validateCoupon, applyCoupon } from "./coupons.js";
import { createCreditAccount, applyCreditBalance } from "./credits.js";
import { createUsageTracker, trackUsage, getUsage, isOverLimit } from "./usage.js";
import { canAccessFeature, getRestrictedFeatures, FEATURE_KEYS } from "./featurePermissions.js";

export function createBillingState() {
  return {
    currentPlan: "free",
    subscription: null,
    checkoutSession: null,
    invoices: [],
    coupons: [],
    credits: createCreditAccount(),
    usage: createUsageTracker(),
    paymentMethod: null,   // { type, last4, brand, expMonth, expYear }
    billingEmail: "",
  };
}

export function canUseFeature(state, featureKey) {
  const limits = getTierLimits(state.currentPlan);
  return canAccessFeature(state.currentPlan, featureKey, limits);
}

export function processCheckout(state, options) {
  // Creates checkout → validates coupon → calculates total → creates invoice → activates subscription
}

export function processUpgrade(state, newPlanId, interval, couponCode) {
  // Validates upgrade → calculates prorated credit → processes → generates invoice
}

export function processDowngrade(state, newPlanId, interval) {
  // Validates downgrade → schedules for period end → returns confirmation
}

export function getBillingSummary(state) {
  // Returns { plan, subscription, usage, credits, nextInvoice, features }
}

export function trackFeatureUsage(state, feature, amount) {
  // Tracks and checks limit, returns { allowed, current, limit }
}
```

### 10. Update `editor-engine/constants/editorConstants.js`

Add billing domain:

```js
export const EDITOR_DOMAINS = Object.freeze({
  // ... existing
  billing: "billing",
});

export const BILLING_FEATURES = Object.freeze([
  "export", "transitions", "effects", "textTemplates", "colorGrading",
  "voiceEnhancement", "backgroundRemoval", "autoReframe", "aiTools",
  "collaboration", "priorityRender", "customExportPresets", "pluginInstall",
]);
```

### 11. Update `editor-engine/core/editorCore.js`

Add billing state and methods.

**New state field** (in `createDefaultState`):
```js
billing: createBillingState(),
```

**New methods on EditorCore**:
```js
// Plan management
canUseFeature(featureKey) → boolean
getRestrictedFeatures() → string[]
getBillingSummary() → object
getCurrentPlan() → { id, name, limits }

// Checkout & subscriptions
startCheckout(planId, interval, couponCode) → checkoutSession
completeCheckout() → subscription
upgradePlan(newPlanId, interval, couponCode) → { subscription, invoice }
downgradePlan(newPlanId, interval) → { subscription, scheduledAt }
cancelSubscription(immediate) → subscription
pauseSubscription() → subscription
resumeSubscription() → subscription

// Invoices & payment
getPaymentHistory(options) → invoice[]
getLatestInvoice() → invoice

// Coupons & credits
applyCoupon(couponCode) → { valid, discount, error }
getCreditBalance() → number
addCredits(amount, description) → creditAccount

// Usage
trackUsage(feature, amount) → { allowed, current, limit }
getUsageSummary() → { exports, aiToolRuns, storage }
resetUsage() → usageTracker
```

### 12. Update `editor-engine/index.js`

Add new exports:

```js
export * from "./billing/plans.js";
export * from "./billing/checkout.js";
export * from "./billing/subscriptions.js";
export * from "./billing/invoices.js";
export * from "./billing/coupons.js";
export * from "./billing/credits.js";
export * from "./billing/usage.js";
export * from "./billing/featurePermissions.js";
export * from "./billing/billingEngine.js";
```

### 13. Update `index.html`

Add billing tab to settings modal:

```html
<button data-settings-section="billing" aria-selected="false">Billing</button>
```

Add billing panel inside the AI panel (or as a separate section):

```html
<div class="billing-panel" data-panel-view="Billing" hidden>
  <div class="billing-plan-cards" data-billing-plan-cards></div>
  <div class="billing-usage" data-billing-usage></div>
  <div class="billing-history" data-billing-history></div>
</div>
```

### 14. Update `app.js`

Add billing UI rendering and handlers.

**Settings — Billing section**:
```js
billing: `
  <div class="settings-section-head"><strong>Billing</strong><span>Manage your plan, payment history, and credits.</span></div>
  <div class="settings-grid">
    ${settingsField("Current Plan", "currentPlan", planBadge())}
    ${settingsField("Payment Method", "paymentMethod", paymentMethodDisplay())}
    ${settingsField("Billing Email", "billingEmail", '<input data-setting type="email" />')}
  </div>
  <div class="billing-plan-upgrade" data-billing-upgrade></div>
  <div class="billing-invoices" data-billing-invoices></div>
`,
```

**AI Panel — Feature gates**:
```js
// In renderAiPanel(), before running a tool:
const usageCheck = editor.trackUsage("aiToolRuns", 1);
if (!usageCheck.allowed) {
  return showToast("AI tool limit reached. Upgrade to Pro for more.");
}
```

**New handlers**:
- `data-billing-upgrade` → plan upgrade click
- `data-billing-invoices` → invoice list
- `data-settings-section="billing"` → billing settings tab

### 15. Update `styles.css`

Add billing-specific styles:

```css
.billing-plan-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.billing-plan-card { ... }
.billing-plan-card.active { border-color: rgba(191, 238, 255, 0.4); }
.billing-plan-card .price { ... }
.billing-usage-bar { ... }
.billing-invoice-row { ... }
```

---

## Data Shape — Complete Billing State

```js
{
  currentPlan: "free" | "pro" | "enterprise",
  subscription: {
    id, planId, interval, status, currentPeriodStart, currentPeriodEnd,
    cancelAtPeriodEnd, trialEnd, createdAt, updatedAt
  },
  checkoutSession: {
    id, planId, interval, couponCode, subtotal, discount, total, tax,
    status, createdAt, completedAt
  },
  invoices: [{
    id, number, subscriptionId, planId, amount, currency, status,
    description, lineItems, discount, tax, total, billingEmail,
    createdAt, paidAt
  }],
  coupons: [{ id, code, type, value, maxUses, usedCount, expiresAt, validPlans, validIntervals }],
  credits: {
    id, balance, lifetimeEarned, lifetimeSpent,
    transactions: [{ id, amount, type, description, createdAt }]
  },
  usage: {
    periodStart, periodEnd,
    counters: { exports, aiToolRuns, storageBytes },
    history: [{ feature, amount, timestamp }]
  },
  paymentMethod: { type, last4, brand, expMonth, expYear },
  billingEmail: string,
}
```

---

## What This Does NOT Do
- No Stripe API calls
- No HTTP client code
- No `.env` file
- No real payment processing
- No webhook handling

## What This DOES Do
- Complete billing data model with all required entities
- Plan tier definitions with feature limits
- Checkout session flow (simulated)
- Subscription lifecycle (create, upgrade, downgrade, cancel, pause, resume)
- Invoice generation and payment history
- Coupon validation and discount calculation
- Credit balance management
- Usage tracking with period resets
- Feature permission gating based on plan
- Foundation for future Stripe integration (all data shapes match Stripe's API structure)
- UI hooks for billing settings, plan cards, and invoice list
