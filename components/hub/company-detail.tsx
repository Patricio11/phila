"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check, Copy, HandCoins, Pencil, ShieldCheck } from "lucide-react";
import type { CompanyDetail } from "@/db/queries/companies";
import { za } from "@/lib/format";
import { Card, CardHead } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/shell/page-head";
import { ExportMenu } from "@/components/hub/export-menu";
import { useToast } from "@/components/ui/toast";
import { recordCompanyPayment, updateCompany } from "@/app/hub/companies/actions";
import { cn } from "@/lib/utils";

const rands = (c: number) => `R${za(Math.round(c / 100))}`;
const MONTH_LABEL = (ym: string) =>
  new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "long", year: "numeric" }).format(new Date(`${ym}-15T12:00:00Z`));
const DAY = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

/** One EAP company - ledger, aggregate usage, employee link, aggregate-only export. */
export function CompanyDetailView({ detail, slug, orgName, nowISO }: {
  detail: CompanyDetail;
  slug: string;
  orgName: string;
  nowISO: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [amountR, setAmountR] = useState("");
  const [payNote, setPayNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [eName, setEName] = useState(detail.name);
  const [eContact, setEContact] = useState(detail.contactName ?? "");
  const [eEmail, setEEmail] = useState(detail.contactEmail ?? "");
  const [ePhone, setEPhone] = useState(detail.contactPhone ?? "");
  const [eRate, setERate] = useState(detail.sessionRateCents != null ? String(Math.round(detail.sessionRateCents / 100)) : "");
  const [eNotes, setENotes] = useState(detail.notes ?? "");

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/o/${slug}/book?c=${detail.bookingToken}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* blocked */ }
  };

  const recordPayment = () => start(async () => {
    const res = await recordCompanyPayment({ companyId: detail.id, amountRands: Number(amountR || 0), note: payNote.trim() });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Payment recorded", description: `${detail.name} now has ${rands(detail.remainingCents + Number(amountR) * 100)} available.` });
    setPayOpen(false); setAmountR(""); setPayNote("");
    router.refresh();
  });

  const saveEdit = () => start(async () => {
    const res = await updateCompany({
      companyId: detail.id, name: eName.trim(), contactName: eContact.trim(), contactEmail: eEmail.trim(),
      contactPhone: ePhone.trim(), sessionRateCents: eRate ? Number(eRate) * 100 : null, notes: eNotes.trim(),
    });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Company updated" });
    setEditOpen(false);
    router.refresh();
  });

  // The report the company receives: aggregate-only, and it says so on it.
  const exportTable = {
    filenameBase: `company-report-${detail.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nowISO.slice(0, 10)}`,
    title: `Wellness usage report · ${detail.name}`,
    subtitle: `${orgName} · ${DAY(nowISO)} · aggregate only - no employee is ever identified`,
    headers: ["Month", "Sessions held", "Amount used"],
    rows: [
      ...detail.monthly.map((m) => [MONTH_LABEL(m.month), String(m.sessions), rands(m.cents)]),
      ["Total", String(detail.sessionsHeld), rands(detail.usedCents)],
      ["Paid to date", "", rands(detail.paidCents)],
      ["Balance remaining", "", rands(detail.remainingCents)],
    ],
  };

  return (
    <div className="rise space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/hub/companies"><ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> All companies</Link>
        </Button>
      </div>

      <PageHead
        title={
          <span className="flex items-center gap-2.5">
            <span className="inline-flex size-10 items-center justify-center rounded-chip bg-accent-soft text-accent"><Building2 className="size-5" strokeWidth={1.9} aria-hidden /></span>
            {detail.name}
          </span>
        }
        summary={`${detail.contactName ?? "No contact"}${detail.contactEmail ? ` · ${detail.contactEmail}` : ""}${detail.sessionRateCents != null ? ` · ${rands(detail.sessionRateCents)} / session` : " · list price per session"}`}
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu table={exportTable} />
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}><Pencil className="size-3.5" strokeWidth={2} aria-hidden /> Edit</Button>
            <Button size="sm" onClick={() => setPayOpen(true)}><HandCoins className="size-4" strokeWidth={2} aria-hidden /> Record payment</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatBox label="Paid to date" value={rands(detail.paidCents)} />
        <StatBox label="Used" value={rands(detail.usedCents)} />
        <StatBox label="Remaining" value={rands(detail.remainingCents)} warn={detail.remainingCents < 100000} danger={detail.remainingCents < 0} />
        <StatBox label="Sessions held" value={`${detail.sessionsHeld}`} sub={`${detail.sessionsUpcoming} upcoming`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHead title="Usage by month" count={detail.monthly.length} />
            <div className="px-[17px] pb-[17px]">
              {detail.monthly.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-text-3">No sessions held yet - usage appears as employees attend.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-wide text-text-3">
                      <th className="py-2 font-semibold">Month</th>
                      <th className="py-2 text-right font-semibold">Sessions</th>
                      <th className="py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.monthly.map((m) => (
                      <tr key={m.month} className="border-b border-border/60 last:border-0">
                        <td className="py-2 text-text">{MONTH_LABEL(m.month)}</td>
                        <td className="py-2 text-right tabular-nums text-text-2">{m.sessions}</td>
                        <td className="py-2 text-right tabular-nums font-medium text-text">{rands(m.cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Retainer payments" count={detail.payments.length} />
            <div className="px-[17px] pb-[17px]">
              {detail.payments.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-text-3">No payments yet - record the first retainer payment.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-text">{rands(p.amountCents)}</div>
                        {p.note && <div className="truncate text-[12px] text-text-3">{p.note}</div>}
                      </div>
                      <span className="shrink-0 text-[12px] tabular-nums text-text-3">{DAY(p.paidAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-[640] text-text">
              <ShieldCheck className="size-4 text-accent" strokeWidth={2} aria-hidden /> Confidentiality
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">
              {detail.employeeCount} employee{detail.employeeCount === 1 ? " is" : "s are"} linked - and {detail.name} can
              never see who. Reports carry usage and money only; the export says so on it.
            </p>
          </Card>

          <Card className="p-4">
            <div className="text-[13.5px] font-[640] text-text">Employee booking link</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">
              Share this with {detail.name} to send to staff. Anyone who books through it is covered by the
              retainer and pays nothing - linked invisibly.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-control border border-border bg-surface-2/50 px-2.5 py-2 text-[11.5px] text-text-2">{link}</code>
              <Button variant="ghost" size="sm" onClick={copyLink} aria-label="Copy employee link">
                {copied ? <Check className="size-4 text-accent" strokeWidth={2.4} aria-hidden /> : <Copy className="size-4" strokeWidth={2} aria-hidden />}
              </Button>
            </div>
          </Card>

          {detail.notes && (
            <Card className="p-4">
              <div className="text-[13.5px] font-[640] text-text">Notes</div>
              <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-2">{detail.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Record payment */}
      <Dialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record a retainer payment"
        description={`${detail.name} pays the practice; sessions draw it down.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPayOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={recordPayment} loading={pending} disabled={!amountR}>Record payment</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount (R)</Label>
            <Input inputMode="numeric" value={amountR} onChange={(e) => setAmountR(e.target.value.replace(/[^\d]/g, ""))} placeholder="25000" />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. Q3 retainer - EFT ref 4471" />
          </div>
        </div>
      </Dialog>

      {/* Edit company */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit company"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={saveEdit} loading={pending} disabled={eName.trim().length < 2}>Save changes</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Company name</Label><Input value={eName} onChange={(e) => setEName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Contact person</Label><Input value={eContact} onChange={(e) => setEContact(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Contact email</Label><Input inputMode="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Contact phone</Label><Input inputMode="tel" value={ePhone} onChange={(e) => setEPhone(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Rate per session (R)</Label><Input inputMode="numeric" value={eRate} onChange={(e) => setERate(e.target.value.replace(/[^\d]/g, ""))} placeholder="List price if empty" /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={eNotes} onChange={(e) => setENotes(e.target.value)} className="min-h-[56px]" /></div>
        </div>
      </Dialog>
    </div>
  );
}

function StatBox({ label, value, sub, warn, danger }: { label: string; value: string; sub?: string; warn?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className={cn("text-[22px] font-bold tabular-nums leading-none", danger ? "text-danger" : warn ? "text-warn" : "text-text")}>{value}</div>
      <div className="mt-1.5 text-[12px] text-text-3">{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}
