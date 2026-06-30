# Phase 15.1  Credit purchase + Billing & usage ✅

*Shipped: 2026-06-30 · Part B · self-serve notification-credit top-ups + a beautiful usage dashboard*

> Goal: the org **sees its usage**, is **notified when credits run low**, and can
> **top up smoothly**  closing the Phase-12 credits loop with a real PSP.

---

## What shipped
- **Billing & usage page (`/hub/billing`)**  one calm place: **SMS + email balances**
  with low-credit warnings, **AI spend vs the monthly cap** (progress bar), **recent
  message activity**, **credit packs** to buy, and a **top-up history**.
- **Low-balance nudges**  a prominent warning on the billing page **and** on the hub
  **overview** ("running low on sms credits  top up so messages keep going out"),
  plus the new **Billing & usage** nav item. The org is notified the moment it lands.
- **Real purchase (Paystack, dormant-ready)**  `lib/payments/paystack.ts` initialises
  a hosted checkout; the hub picks a pack → pays → returns. A **`charge.success`
  webhook** *and* the redirect-callback both **settle idempotently** (the credit
  ledger is keyed on the payment ref), so a top-up is never missed or double-counted.
  Dormant + honest until the super-admin configures Paystack in `/admin/integrations`
  (encrypted, Test connection, switch on  not an env var); the Phase-12 super-admin
  manual grant remains as a fallback.
- **Schema**  `payments` (transaction record, unique on the provider ref;
  migration 0017, RLS'd); credit packs in `lib/payments/packs.ts`.

## Flow
Buy pack → `startCreditPurchase` creates a pending payment + Paystack checkout →
hub pays → webhook/callback → `settlePayment` flips it to paid and `applyCredit`
tops up the balance (idempotent on `purchase_<ref>`).

## Tests
- Integration: a paid pack tops up exactly once; a replayed settle is a no-op
  (idempotent on the payment ref); the history shows it paid. 94 unit/integration
  green; prod build clean; tsc + lint clean. Screenshots in `/screenshots`.

## Remaining for Phase 15 (the two larger money flows)
- **15A  platform subscription billing** (orgs → Phila): plans, trials, upgrades,
  proration, dunning, receipts.
- **15B  org BYO-gateway invoice payments** (clients → org): the org's own
  connected gateway charges invoices; funds settle to the org.

15.1's PSP seam + `payments` table are the foundation both build on.
