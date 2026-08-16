"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarCheck2, CalendarPlus, FileText, Hourglass, Search, UserRound, X } from "lucide-react";
import type { WaitlistDetail } from "@/db/queries/waitlist";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { CreateAppointmentModal, type SchedulingOptions } from "@/components/scheduling/create-appointment-modal";
import { Dialog } from "@/components/ui/dialog";
import { ResponseView } from "@/components/forms/response-view";
import type { FormField } from "@/lib/domain/types";
import { removeFromWaitlist } from "@/app/hub/waitlist/actions";
import { downloadResponsePdf } from "@/lib/export/response-pdf";
import { cn } from "@/lib/utils";

export type WaitlistRow = WaitlistDetail;

const DAY = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));
const WHEN = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

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
 * Batch 3d - the waitlist tells the whole story. **Waiting** is the queue;
 * **Booked** is everyone recently placed, each showing the session they are
 * heading to. Booking anywhere (this page, the calendar, the company tab,
 * even self-booking) moves a person across automatically - the server settles
 * the wait, so no surface has to remember.
 */
export function WaitlistBoard({ rows, scheduling, nowISO }: {
  rows: WaitlistRow[];
  scheduling: SchedulingOptions;
  nowISO: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"waiting" | "placed">("waiting");
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState<string>("all");
  const [booking, setBooking] = useState<WaitlistRow | null>(null);
  // Batch 3e - their intake answers, read right here before booking.
  const [reading, setReading] = useState<WaitlistRow | null>(null);

  const waiting = rows.filter((r) => r.status === "waiting");
  const placed = rows
    .filter((r) => r.status === "placed")
    .sort((a, b) => (b.placedAt ?? "").localeCompare(a.placedAt ?? ""));

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (r.companyId && r.companyName) seen.set(r.companyId, r.companyName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const pool = tab === "waiting" ? waiting : placed;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool
      .filter((r) => (company === "all" ? true : r.companyId === company))
      .filter((r) => !q || r.clientName.toLowerCase().includes(q) || (r.companyName ?? "").toLowerCase().includes(q));
  }, [pool, query, company]);

  const remove = (r: WaitlistRow) =>
    start(async () => {
      const res = await removeFromWaitlist({ id: r.id });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Removed from the waitlist", description: `${r.clientName.split(" ")[0]} is no longer waiting.` });
      router.refresh();
    });

  const COMPANY_CHIPS = [
    { key: "all", label: "Everyone", n: pool.length },
    ...companies.map((c) => ({ key: c.id, label: c.name, n: pool.filter((r) => r.companyId === c.id).length })),
  ].filter((c) => c.n > 0 || c.key === "all");

  return (
    <Card>
      <CardHead
        title="Waitlist"
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

      {/* Waiting vs Booked - the two halves of the story. */}
      <div className="flex flex-wrap items-center gap-1.5 px-[17px] pb-2.5">
        {([
          { key: "waiting" as const, label: "Waiting", icon: Hourglass, n: waiting.length },
          { key: "placed" as const, label: "Booked", icon: CalendarCheck2, n: placed.length },
        ]).map(({ key, label, icon: Icon, n }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === key ? "border-accent bg-accent text-accent-ink" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} aria-hidden />
            {label}
            <span className={cn("tabular-nums", tab === key ? "text-accent-ink/75" : "text-text-3")}>{n}</span>
          </button>
        ))}

        {COMPANY_CHIPS.length > 1 && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
        {COMPANY_CHIPS.length > 1 && COMPANY_CHIPS.map((c) => (
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

      <div className="px-[17px] pb-[17px]">
        {shown.length === 0 ? (
          tab === "waiting" ? (
            <EmptyState
              icon={UserRound}
              title={waiting.length === 0 ? "Nobody is waiting" : "Nobody matches"}
              body={waiting.length === 0
                ? "People appear here when they complete an intake form that feeds the waitlist, or when you add them from a client record."
                : "Clear the search or pick another employer."}
            />
          ) : (
            <EmptyState
              icon={CalendarCheck2}
              title={placed.length === 0 ? "Nobody booked off the list yet" : "Nobody matches"}
              body={placed.length === 0
                ? "When someone waiting gets a session - booked from here, the calendar, or anywhere else - they move across automatically."
                : "Clear the search or pick another employer."}
            />
          )
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
                <Avatar name={r.clientName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Link href={`/hub/clients/${r.clientId}`} className="text-[13.5px] font-[600] text-text hover:text-accent">
                      {r.clientName}
                    </Link>
                    {r.companyName && (
                      <span className="inline-flex items-center gap-1 rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">
                        <Building2 className="size-3" strokeWidth={2} aria-hidden /> {r.companyName}
                      </span>
                    )}
                    {r.status === "placed" ? (
                      <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">
                        <CalendarCheck2 className="size-3" strokeWidth={2} aria-hidden /> Booked{r.placedAt ? ` ${DAY(r.placedAt)}` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-chip bg-warn-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-warn">
                        <Hourglass className="size-3" strokeWidth={2} aria-hidden /> Waiting {waited(r.createdAt, nowISO)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-3">
                    {r.status === "placed" ? (
                      r.nextAt
                        ? <span className="text-text-2">Next session {WHEN(r.nextAt)}{r.nextCounsellorName ? ` · ${r.nextCounsellorName}` : ""}</span>
                        : <span>Session held or moved - see their record.</span>
                    ) : (
                      <>
                        <span>joined {DAY(r.createdAt)}</span>
                        {r.clientEmail && <span className="truncate">· {r.clientEmail}</span>}
                      </>
                    )}
                  </div>
                  {r.status === "waiting" && r.note && <p className="mt-1 text-[11.5px] leading-snug text-text-2">{r.note}</p>}
                </div>

                {r.formAnswers && (
                  <button
                    type="button"
                    onClick={() => setReading(r)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                  >
                    <FileText className="size-3.5" strokeWidth={2} aria-hidden /> {r.formTitle ?? "Their answers"}
                  </button>
                )}
                {r.status === "waiting" && (
                  <>
                    <Button size="sm" onClick={() => setBooking(r)}>
                      <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden /> Book
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)} disabled={pending} aria-label={`Remove ${r.clientName} from the waitlist`}>
                      <X className="size-3.5" strokeWidth={2} aria-hidden />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Their answers, in place - the fill page only tells a completed
          response "already submitted", which helps nobody. */}
      <Dialog
        open={Boolean(reading)}
        onClose={() => setReading(null)}
        title={reading?.formTitle ?? "Their answers"}
        description={reading ? `${reading.clientName}${reading.companyName ? ` · via ${reading.companyName}` : ""}` : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            {reading?.formAnswers && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => downloadResponsePdf({ formTitle: reading.formTitle ?? "Form answers", respondent: reading.clientName, fields: (reading.formFields ?? []) as FormField[], answers: reading.formAnswers ?? {} })}
              >
                Download PDF
              </Button>
            )}
            {reading?.status === "waiting" && (
              <Button size="sm" onClick={() => { const r = reading; setReading(null); setBooking(r); }}>
                <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden /> Book {reading.clientName.split(" ")[0]}
              </Button>
            )}
          </div>
        }
      >
        {reading?.formAnswers && (
          <ResponseView fields={(reading.formFields ?? []) as FormField[]} answers={reading.formAnswers} />
        )}
      </Dialog>

      {booking && (
        <CreateAppointmentModal
          open
          onClose={() => setBooking(null)}
          options={scheduling}
          initial={{ clientId: booking.clientId, counsellorId: booking.counsellorId ?? undefined, serviceId: booking.serviceId ?? undefined }}
          onCreated={() => {
            setBooking(null);
            toast({ tone: "success", title: "Booked off the waitlist", description: `${booking.clientName.split(" ")[0]} has a session - they've moved to Booked.` });
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}
