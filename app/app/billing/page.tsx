import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import type { PaymentStatus } from "@/lib/domain/enums";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

const STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-accent-soft text-accent" },
  unpaid: { label: "Due", cls: "bg-warn-soft text-warn" },
  cancelled: { label: "Cancelled", cls: "bg-surface-2 text-text-3" },
  refunded: { label: "Refunded", cls: "bg-info-soft text-info" },
};

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}
function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));
}

export default async function CounsellorBillingPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const [invoices, clients] = await Promise.all([
    provider.listCounsellorInvoices(me.id),
    provider.listClients(membership.orgId),
  ]);
  const nameOf = new Map(clients.map((c) => [c.id, c.name]));

  const month = new Date().toISOString().slice(0, 7);
  const paidThisMonth = invoices.filter((i) => i.status === "paid" && i.issuedAt.startsWith(month)).reduce((s, i) => s + i.amountCents, 0);
  const outstanding = invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="rise space-y-6">
      <PageHead title="Billing" summary="Invoices for your clients' sessions." />

      <div className="grid grid-cols-2 gap-3.5 sm:max-w-md">
        <Card className="p-4">
          <div className="text-[22px] font-bold tabular-nums text-accent">{rands(paidThisMonth)}</div>
          <div className="text-[12px] text-text-2">Paid this month</div>
        </Card>
        <Card className="p-4">
          <div className="text-[22px] font-bold tabular-nums text-warn">{rands(outstanding)}</div>
          <div className="text-[12px] text-text-2">Outstanding</div>
        </Card>
      </div>

      <Card>
        <CardHead title="Invoices" count={invoices.length} />
        <div className="px-[17px] pb-[17px]">
          {invoices.length === 0 ? (
            <EmptyState icon={Receipt} title="No invoices yet" body="Invoices for your sessions will appear here." />
          ) : (
            <ul className="space-y-2">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 rounded-control border border-border p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-text">{nameOf.get(inv.clientId) ?? "Client"}</div>
                    <div className="text-[11.5px] text-text-3">{inv.number} · {inv.serviceName} · {dateLabel(inv.issuedAt)}</div>
                  </div>
                  <span className={cn("shrink-0 rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", STATUS[inv.status].cls)}>{STATUS[inv.status].label}</span>
                  <span className="w-20 shrink-0 text-right text-[14px] font-semibold tabular-nums text-text">{rands(inv.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
