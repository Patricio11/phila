# Phase 15  Payments ✅

*Shipped: 2026-06-30 · Part B · two real money flows + self-serve credits, all on one PSP seam*

> Goal: (A) orgs pay Phila, (B) clients pay their org, (15.1) orgs buy notification
> credits  real, idempotent, and load-shedding-safe.

---

## The integration model (the correction)
Every gateway key is **configured in-app, encrypted at rest, switched on with a Test
connection**  never an env var:
- **Platform gateway** (Phila's own Paystack, for credits + subscriptions) → super-admin
  in **`/admin/integrations`** (`platform_integrations` table).
- **Each org's own gateway** (for client invoices) → the org in **Settings → Payments**
  (`org_payment_connections` table).

`lib/payments/paystack.ts` has key-explicit primitives (`paystackInit/Verify/
SignatureValid`) so the same code serves both the platform key and each org's key.

## 15.1  Credit purchase + Billing & usage
`/hub/billing`: balances, AI spend vs cap, activity, **credit packs → Paystack**, top-up
history, **low-balance nudges** (billing + overview). Settles idempotently on the payment ref.

## 15A  Platform subscription billing (orgs → Phila)
`/hub/billing/plan`: pick a plan → pay Phila via the **platform** gateway → the
**`subscriptions`** row activates **idempotently** (settle keyed on the ref) with the next
period set. `getOrgSubscription`/`listPlans` read real rows; super-admin MRR comes from them.
Plan catalogue in `lib/billing/plans.ts`; Masizakhe's subscription is **seeded** (Community).

## 15B  Org gateway + client invoice payments (clients → org)
Org connects its **own** Paystack (Test connection, encrypted). Every unpaid invoice gets a
**signed, unguessable pay-link** ("Pay link" copies it); the client pays on the public
**`/pay/[token]`** page through the **org's** key (funds settle to the **org**), and the
invoice is **marked paid idempotently** (webhook routes by ref → org key; callback is the
backstop). No gateway? The pay page shows an **honest EFT fallback**.

## Webhook (one endpoint, three purposes)
`/api/webhooks/paystack` looks the reference up first to pick the right secret + settle path:
credit packs / subscriptions verify with **Phila's** key; org invoices verify with the
**org's** key. Every settle is idempotent.

## Schema (migrations 0017–0019, all RLS'd / platform-scoped)
`payments` (+`invoice_id`), `platform_integrations`, `org_payment_connections`, `subscriptions`.

## Proof
- Integration tests: credit top-up, **invoice payment**, **subscription activation** all
  settle once and no-op on replay; org-gateway secret round-trips through encryption and
  gates on `enabled`. **97 unit/integration green**, prod build clean, tsc + lint clean.
- Screenshots in `/screenshots`: public pay page, plan picker, connected gateway, admin PSP.

## Honest follow-ups (noted, not silently dropped)
- 15A: trials, proration, dunning, emailed receipts, plan-entitlement enforcement.
- 15B: Stitch / Ozow / Yoco adapters (Paystack is live; others show "soon"); **income
  prediction** belongs with Phase 16 reporting.
