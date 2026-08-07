"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, Copy, Plus, Users } from "lucide-react";
import type { CompanySummary } from "@/db/queries/companies";
import { za } from "@/lib/format";
import { Dialog } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Input, Label, FieldError, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createCompany } from "@/app/hub/companies/actions";
import { cn } from "@/lib/utils";

const rands = (c: number) => `R${za(Math.round(c / 100))}`;

/** EAP companies board (batch 2j) - list, create, and the employee link. */
export function CompaniesBoard({ companies, slug }: { companies: CompanySummary[]; slug: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [rateR, setRateR] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const linkFor = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/o/${slug}/book?c=${token}`;

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
      toast({ tone: "default", title: "Employee link copied", description: "Share it with the company - anyone who books through it is covered, confidentially." });
    } catch { /* clipboard blocked */ }
  };

  const create = () => {
    setAttempted(true);
    if (name.trim().length < 2) return;
    start(async () => {
      const res = await createCompany({
        name: name.trim(), contactName: contactName.trim(), contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(), sessionRateCents: rateR ? Number(rateR) * 100 : null, notes: notes.trim(),
      });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Company added", description: "Record their first payment and share the employee link from the company page." });
      setOpen(false); setName(""); setContactName(""); setContactEmail(""); setContactPhone(""); setRateR(""); setNotes(""); setAttempted(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" strokeWidth={2.2} aria-hidden /> Add company
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card className="p-2">
          <EmptyState icon={Building2} title="No companies yet" body="Add an employer who covers sessions for their staff - you'll get a booking link to share with their employees." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {companies.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-chip bg-accent-soft text-accent">
                  <Building2 className="size-5" strokeWidth={1.9} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/hub/companies/${c.id}`} className="text-[15px] font-[650] text-text hover:underline">{c.name}</Link>
                  <div className="mt-0.5 text-[12px] text-text-3">
                    {c.contactName || "No contact"}{c.sessionRateCents != null ? ` · ${rands(c.sessionRateCents)} / session` : " · list price per session"}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-chip px-2 py-1 text-[12px] font-semibold tabular-nums", c.remainingCents < 0 ? "bg-danger-soft text-danger" : c.remainingCents < 100000 ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent")}>
                  {rands(c.remainingCents)} left
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-control bg-surface-2/50 py-2">
                  <div className="text-[15px] font-bold tabular-nums text-text">{rands(c.paidCents)}</div>
                  <div className="text-[10.5px] uppercase tracking-wide text-text-3">Paid</div>
                </div>
                <div className="rounded-control bg-surface-2/50 py-2">
                  <div className="text-[15px] font-bold tabular-nums text-text">{rands(c.usedCents)}</div>
                  <div className="text-[10.5px] uppercase tracking-wide text-text-3">Used</div>
                </div>
                <div className="rounded-control bg-surface-2/50 py-2">
                  <div className="text-[15px] font-bold tabular-nums text-text">{c.sessionsHeld}</div>
                  <div className="text-[10.5px] uppercase tracking-wide text-text-3">Sessions</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
                  <Users className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {c.employeeCount} employee{c.employeeCount === 1 ? "" : "s"} · confidential
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => copyLink(c.bookingToken)}>
                    {copied === c.bookingToken ? <Check className="size-3.5 text-accent" strokeWidth={2.4} aria-hidden /> : <Copy className="size-3.5" strokeWidth={2} aria-hidden />} Employee link
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/hub/companies/${c.id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a company"
        description="An employer who covers sessions for their staff. You'll get an employee booking link to share."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={create} loading={pending}>Add company</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ubuntu Logistics (Pty) Ltd" />
            {attempted && name.trim().length < 2 ? <FieldError>Give the company a name.</FieldError> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact person</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="HR / wellness contact" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact email</Label>
              <Input inputMode="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hr@company.co.za" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact phone</Label>
              <Input inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+27 ..." />
            </div>
            <div className="space-y-1.5">
              <Label>Rate per session (R)</Label>
              <Input inputMode="numeric" value={rateR} onChange={(e) => setRateR(e.target.value.replace(/[^\d]/g, ""))} placeholder="List price if empty" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[56px]" placeholder="Contract terms, billing cycle…" />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
