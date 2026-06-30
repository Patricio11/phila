"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { getDb } from "@/db/client";
import { payments } from "@/db/schema";
import { planById } from "@/lib/billing/plans";
import { paystackConfigured, initTransaction, verifyTransaction } from "@/lib/payments/paystack";
import { settleSubscription } from "@/db/queries/subscriptions";

function ref(): string {
  return `psub_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

/** Subscribe the org to a Phila plan, paid to Phila via the platform gateway (15A). */
export async function startPlanCheckout(raw: { planId: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = z.object({ planId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const plan = planById(parsed.data.planId);
  if (!plan) return { ok: false, error: "That plan isn't available." };
  if (!(await paystackConfigured())) return { ok: false, error: "Plan billing isn't switched on yet  Phila can change your plan in the meantime." };

  const reference = ref();
  await getDb().insert(payments).values({
    orgId: membership.orgId, provider: "paystack", providerRef: reference, purpose: "subscription",
    packId: plan.id, amountCents: plan.priceCents, status: "pending", createdAt: new Date(),
  });
  const callbackUrl = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/hub/billing/plan?ref=${reference}`;
  const init = await initTransaction({ email: principal.email, amountCents: plan.priceCents, reference, callbackUrl, metadata: { orgId: membership.orgId, planId: plan.id } });
  if (!init.ok || !init.authorizationUrl) return { ok: false, error: init.error ?? "Could not start the payment." };

  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/subscription:${plan.id}`, reason: "start_plan_checkout" });
  return { ok: true, url: init.authorizationUrl };
}

/** Verify + activate on the redirect back (the webhook is the backstop). */
export async function confirmPlanCheckout(reference: string): Promise<{ active: boolean; planId: string | null }> {
  await requireHub();
  if ((await verifyTransaction(reference)) !== "success") return { active: false, planId: null };
  return settleSubscription(reference);
}
