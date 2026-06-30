import { CheckCircle2, AlertTriangle, Mail, Smartphone, Wallet } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { CreditPacks } from "@/components/hub/credit-packs";
import { getCreditBalances, listRecentMessages } from "@/db/queries/messaging";
import { getAiSettings, getAiSpendThisMonth } from "@/db/queries/ai";
import { listPayments } from "@/db/queries/payments";
import { verifyTransaction } from "@/lib/payments/paystack";
import { settlePayment } from "@/db/queries/payments";
import { CREDIT_PACKS, LOW_CREDIT_THRESHOLD } from "@/lib/payments/packs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing & usage" };

const rands = (cents: number) => `R${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { membership } = await requireHub();
  const { ref } = await searchParams;

  // Returning from Paystack  verify + settle (the webhook is the backstop).
  let justCredited: { credited: number; channel: string | null } | null = null;
  if (ref && (await verifyTransaction(ref)) === "success") {
    const r = await settlePayment(ref);
    if (r.credited > 0) justCredited = r;
  }

  const [credits, aiSettings, aiSpent, recent, history] = await Promise.all([
    getCreditBalances(membership.orgId),
    getAiSettings(membership.orgId),
    getAiSpendThisMonth(membership.orgId),
    listRecentMessages(membership.orgId, 8),
    listPayments(membership.orgId, 8),
  ]);

  const low = (["sms", "email"] as const).filter((c) => credits[c] < LOW_CREDIT_THRESHOLD);
  const aiPct = aiSettings.monthlyCapCents > 0 ? Math.min(100, Math.round((aiSpent / aiSettings.monthlyCapCents) * 100)) : 0;

  return (
    <div className="rise mx-auto max-w-4xl space-y-6">
      <PageHead title="Billing & usage" summary="Your notification credits, AI spend, and top-ups  all in one place." />

      {justCredited && (
        <Banner tone="ok" icon={CheckCircle2}>
          <b>{justCredited.credited.toLocaleString()} {justCredited.channel} credits added.</b> You&apos;re topped up  thank you.
        </Banner>
      )}
      {low.length > 0 && !justCredited && (
        <Banner tone="warn" icon={AlertTriangle}>
          You&apos;re running low on <b>{low.join(" & ")}</b> credits. Top up below so messages keep going out.
        </Banner>
      )}

      {/* Credit balances + packs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CreditChannel icon={Smartphone} label="SMS" balance={credits.sms} packs={CREDIT_PACKS.filter((p) => p.channel === "sms")} />
        <CreditChannel icon={Mail} label="Email" balance={credits.email} packs={CREDIT_PACKS.filter((p) => p.channel === "email")} />
      </div>

      {/* AI spend */}
      <Card>
        <CardHead title="AI assistant usage" />
        <div className="space-y-2 px-[17px] pb-[17px]">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[22px] font-[720] tabular-nums text-text">{rands(aiSpent)}</div>
              <div className="text-[12px] text-text-3">used this month {aiSettings.aiEnabled ? "" : "· scribe is off"}</div>
            </div>
            <div className="text-[12.5px] text-text-2">cap {rands(aiSettings.monthlyCapCents)}</div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${aiPct >= 90 ? "bg-danger" : aiPct >= 70 ? "bg-warn" : "bg-accent"}`} style={{ width: `${aiPct}%` }} />
          </div>
          <p className="text-[11px] text-text-3">Change the monthly cap in Settings → AI assistant.</p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent messages */}
        <Card>
          <CardHead title="Recent messages" />
          <div className="px-[17px] pb-[17px]">
            {recent.length === 0 ? (
              <p className="text-[12.5px] text-text-3">No messages yet  they&apos;ll appear here as they go out.</p>
            ) : (
              <ul className="divide-y divide-border text-[12.5px]">
                {recent.map((m, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5">
                    <span className="w-14 shrink-0 capitalize text-text-2">{m.channel}</span>
                    <span className="min-w-0 flex-1 truncate text-text-3">{m.toMasked}</span>
                    <span className="shrink-0 capitalize text-text-3">{m.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Purchase history */}
        <Card>
          <CardHead title="Top-up history" />
          <div className="px-[17px] pb-[17px]">
            {history.length === 0 ? (
              <p className="text-[12.5px] text-text-3">No top-ups yet.</p>
            ) : (
              <ul className="divide-y divide-border text-[12.5px]">
                {history.map((p) => (
                  <li key={p.providerRef} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 text-text">{p.creditsAmount.toLocaleString()} {p.channel}</span>
                    <span className="shrink-0 text-text-3">{rands(p.amountCents)}</span>
                    <span className={`w-14 shrink-0 text-right text-[11px] font-medium capitalize ${p.status === "paid" ? "text-accent" : p.status === "failed" ? "text-danger" : "text-text-3"}`}>{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CreditChannel({ icon: Icon, label, balance, packs }: { icon: typeof Mail; label: string; balance: number; packs: typeof CREDIT_PACKS }) {
  const low = balance < LOW_CREDIT_THRESHOLD;
  return (
    <Card>
      <CardHead title={`${label} credits`} action={<Icon className="size-4 text-text-3" strokeWidth={2} aria-hidden />} />
      <div className="space-y-3 px-[17px] pb-[17px]">
        <div className="flex items-baseline gap-2">
          <span className={`text-[30px] font-[740] tabular-nums ${low ? "text-warn" : "text-text"}`}>{balance.toLocaleString()}</span>
          <span className="text-[12px] text-text-3">credits left</span>
          {low && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn"><AlertTriangle className="size-3" strokeWidth={2} aria-hidden /> Low</span>}
        </div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-text-3">Top up</div>
        <CreditPacks packs={packs} />
      </div>
    </Card>
  );
}

function Banner({ tone, icon: Icon, children }: { tone: "ok" | "warn"; icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-card border px-4 py-3 text-[13px] ${tone === "ok" ? "border-accent/30 bg-accent-soft/40 text-text" : "border-warn/40 bg-warn-soft text-warn"}`}>
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
      <p>{children}</p>
    </div>
  );
}
