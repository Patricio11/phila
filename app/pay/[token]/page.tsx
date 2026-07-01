import { notFound } from "next/navigation";
import { CheckCircle2, Landmark } from "lucide-react";
import { BrandMark } from "@/components/brand/logo";
import { verifyInvoiceToken } from "@/lib/payments/invoice-link";
import { getPayableInvoice } from "@/db/queries/invoice-payments";
import { confirmInvoicePayment } from "./actions";
import { PayForm } from "@/components/pay/pay-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay your invoice" };

const rands = (c: number) => `R${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { token } = await params;
  const { ref } = await searchParams;
  const invoiceId = verifyInvoiceToken(token);
  if (!invoiceId) notFound();

  let inv;
  try { inv = await getPayableInvoice(invoiceId); } catch { inv = null; }
  if (!inv) notFound();

  let paid = inv.status === "paid";
  if (ref && !paid) paid = (await confirmInvoicePayment(token, ref)).paid;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2 text-text-2">
          <BrandMark size={28} />
          <span className="text-[15px] font-[680] tracking-[-0.01em] text-text">Phila</span>
        </div>

        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-e2">
          <div className="border-b border-border px-6 py-5">
            <div className="text-[12px] text-text-3">Pay {inv.orgName}</div>
            <div className="mt-1 text-[28px] font-[740] tabular-nums tracking-[-0.02em] text-text">{rands(inv.amountCents)}</div>
            <div className="text-[12.5px] text-text-3">Invoice {inv.number} · {inv.serviceName}</div>
          </div>

          <div className="px-6 py-5">
            {paid ? (
              <div className="space-y-2 text-center">
                <CheckCircle2 className="mx-auto size-10 text-accent" strokeWidth={1.8} aria-hidden />
                <div className="text-[15px] font-[660] text-text">Paid  thank you</div>
                <p className="text-[12.5px] text-text-3">Invoice {inv.number} is settled. A receipt has been emailed to you. You can close this page.</p>
              </div>
            ) : inv.gatewayReady ? (
              <PayForm token={token} amountLabel={rands(inv.amountCents)} />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13.5px] font-[620] text-text"><Landmark className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Pay by EFT</div>
                <p className="text-[12.5px] text-text-3">{inv.orgName} hasn&apos;t switched on online card payments. Please pay using the banking details on your invoice and use <b className="text-text-2">{inv.number}</b> as the reference.</p>
                <p className="text-[11px] text-text-3">Due {date(inv.dueAt)}.</p>
              </div>
            )}
          </div>

          {!paid && inv.gatewayReady && (
            <div className="border-t border-border px-6 py-3 text-center text-[11px] text-text-3">Due {date(inv.dueAt)} · Secured by Paystack</div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-text-3">Powered by Phila · payments settle directly to {inv.orgName}</p>
      </div>
    </main>
  );
}
