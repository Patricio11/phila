"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import type { CredentialBody, CredentialStatus } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

export interface TeamLoadRow {
  id: string;
  name: string;
  total: number;
  seen: number;
  upcoming: number;
  pct: number; // of weekly capacity
  credentialBody: CredentialBody;
  credentialStatus: CredentialStatus;
}

type Filter = "all" | "stretched" | "capacity" | "unverified";

/**
 * Team this week - staffing load at a glance, now filterable: who's stretched,
 * who has room for more, whose credentials still need verifying. Search for a
 * name when the team grows. Same fixed widget height as the rest of the
 * dashboard; the list scrolls inside.
 */
export function TeamThisWeek({ rows, className, periodLabel }: { rows: TeamLoadRow[]; className?: string; periodLabel?: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => ({
    all: rows.length,
    stretched: rows.filter((r) => r.pct >= 80).length,
    capacity: rows.filter((r) => r.pct < 80).length,
    unverified: rows.filter((r) => r.credentialStatus !== "verified").length,
  }), [rows]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) =>
        filter === "stretched" ? r.pct >= 80
        : filter === "capacity" ? r.pct < 80
        : filter === "unverified" ? r.credentialStatus !== "verified"
        : true)
      .filter((r) => !t || r.name.toLowerCase().includes(t));
  }, [rows, filter, q]);

  const CHIPS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "stretched", label: "Near capacity" },
    { key: "capacity", label: "Has room" },
    { key: "unverified", label: "Unverified" },
  ];

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHead
        title={periodLabel ? `Team ${periodLabel}` : "Team this week"}
        count={shown.length}
        action={
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search team"
              aria-label="Search team"
              className="h-7 w-36 rounded-control border border-border bg-surface pl-7 pr-2 text-[12px] text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
        }
      />
      <div className="flex flex-wrap gap-1.5 px-[17px] pb-2.5">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={cn(
              "inline-flex h-[26px] items-center gap-1 rounded-chip border px-2 text-[11.5px] font-medium transition-colors",
              filter === c.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
            )}
          >
            {c.label}
            <span className="tabular-nums opacity-70">{counts[c.key]}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-[17px] pb-[17px]">
        {shown.length === 0 && (
          <p className="pt-3 text-[12.5px] text-text-3">No one matches  clear the search or pick another filter.</p>
        )}
        {shown.map((r) => {
          const stretched = r.pct >= 80;
          return (
            <div key={r.id} className="flex items-center gap-3">
              <Avatar name={r.name} size="sm" verified={r.credentialStatus === "verified"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-text">{r.name}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-text-3">{r.total} session{r.total === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className={cn("h-full rounded-full", stretched ? "bg-warn" : "bg-accent")} style={{ width: `${Math.max(r.pct, 3)}%` }} />
                  </div>
                  <CredentialChip body={r.credentialBody} status={r.credentialStatus} />
                </div>
                <div className="mt-0.5 text-[11px] text-text-3">{r.seen} seen · {r.upcoming} upcoming{stretched ? " · near capacity" : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
