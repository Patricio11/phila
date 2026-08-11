"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarPlus, ExternalLink, Search, UserRound, X } from "lucide-react";
import type { WaitlistDetail } from "@/db/queries/waitlist";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { CreateAppointmentModal, type SchedulingOptions } from "@/components/scheduling/create-appointment-modal";
import { removeFromWaitlist } from "@/app/hub/waitlist/actions";
import { cn } from "@/lib/utils";

export type WaitlistRow = WaitlistDetail;

const DAY = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));

/** How long someone has been waiting, in the words a person would use. */
function waited(fromISO: string, nowISO: string): string {
  const days = Math.max(0, Math.floor((new Date(nowISO).getTime() - new Date(fromISO).getTime()) / 86_400_000));
  if (days === 0) return "since today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

/**
 * Batch 2t - everyone waiting for a first session: who they are, which employer
 * is paying (if any), how long they have waited, the intake they completed, and
 * a Book button that opens the ordinary appointment modal prefilled.
 */
export function WaitlistBoard({ rows, scheduling, nowISO }: {
  rows: WaitlistRow[];
  scheduling: SchedulingOptions;
  nowISO: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState<string>("all");
  const [booking, setBooking] = useState<WaitlistRow | null>(null);

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (r.companyId && r.companyName) seen.set(r.companyId, r.companyName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (company === "all" ? true : company === "none" ? !r.companyId : r.companyId === company))
      .filter((r) => !q || r.clientName.toLowerCase().includes(q) || (r.companyName ?? "").toLowerCase().includes(q));
  }, [rows, query, company]);

  const remove = (r: WaitlistRow) =>
    start(async () => {
      const res = await removeFromWaitlist({ id: r.id });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Removed from the waitlist", description: `${r.clientName.split(" ")[0]} is no longer waiting.` });
      router.refresh();
    });

  const CHIPS = [
    { key: "all", label: "Everyone", n: rows.length },
    ...companies.map((c) => ({ key: c.id, label: c.name, n: rows.filter((r) => r.companyId === c.id).length })),
    { key: "none", label: "No employer", n: rows.filter((r) => !r.companyId).length },
  ].filter((c) => c.n > 0 || c.key === "all");

  return (
    <Card>
      <CardHead
        title="Waiting"
        count={shown.length}
        action={
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search the waitlist"
              className="h-8 w-36 rounded-control border border-border bg-surface pl-8 pr-2 text-[12.5px] text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
        }
      />

      {CHIPS.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-[17px] pb-2.5">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCompany(c.key)}
              aria-pressed={company === c.key}
              className={cn(
                "inline-flex h-[26px] items-center gap-1 rounded-chip border px-2 text-[11.5px] font-medium transition-colors",
                company === c.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
              )}
            >
              {c.label}
              <span className="tabular-nums opacity-70">{c.n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="px-[17px] pb-[17px]">
        {shown.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={rows.length === 0 ? "Nobody is waiting" : "Nobody matches"}
            body={rows.length === 0
              ? "People appear here when they complete an intake form that feeds the waitlist, or when you add them from a client record."
              : "Clear the search or pick another employer."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/hub/clients/${r.clientId}`} className="text-[13.5px] font-[600] text-text hover:text-accent">
                    {r.clientName}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-3">
                    {r.companyName && (
                      <span className="inline-flex items-center gap-1 text-text-2">
                        <Building2 className="size-3" strokeWidth={2} aria-hidden /> {r.companyName}
                      </span>
                    )}
                    <span>waiting {waited(r.createdAt, nowISO)} · since {DAY(r.createdAt)}</span>
                    {r.clientEmail && <span className="truncate">· {r.clientEmail}</span>}
                  </div>
                  {r.note && <p className="mt-1 text-[11.5px] leading-snug text-text-2">{r.note}</p>}
                </div>

                {r.formToken && (
                  <a
                    href={`/f/${r.formToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                  >
                    <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden /> {r.formTitle ?? "Their answers"}
                  </a>
                )}
                <Button size="sm" onClick={() => setBooking(r)}>
                  <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden /> Book
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r)} disabled={pending} aria-label={`Remove ${r.clientName} from the waitlist`}>
                  <X className="size-3.5" strokeWidth={2} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {booking && (
        <CreateAppointmentModal
          open
          onClose={() => setBooking(null)}
          options={scheduling}
          initial={{ clientId: booking.clientId, counsellorId: booking.counsellorId ?? undefined, serviceId: booking.serviceId ?? undefined }}
          onCreated={() => { setBooking(null); router.refresh(); }}
        />
      )}
    </Card>
  );
}
