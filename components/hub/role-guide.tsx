"use client";

import { useState } from "react";
import { ChevronDown, Shield, HeartPulse, CalendarDays, Wallet, BarChart3, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

/**
 * The role reference — the redaction matrix (lib/auth/roles.ts) told as a calm,
 * honest guide so an org admin can see, at a glance, exactly what each role reaches
 * and what it can never touch. Clinical notes are the load-bearing boundary, so every
 * card names how it treats them.
 */
interface RoleMeta {
  icon: LucideIcon;
  tone: string; // icon chip
  tagline: string;
  can: string[];
  guard: string; // the one protective sentence — usually about notes
}

const ROLES: Record<TeamRole, RoleMeta> = {
  org_admin: {
    icon: Shield,
    tone: "bg-accent-soft text-accent",
    tagline: "Runs the practice",
    can: ["Manage team, roles & settings", "All schedules, clients & billing", "Funders & reporting"],
    guard: "Can open a note only when needed — and every such view is logged.",
  },
  counsellor: {
    icon: HeartPulse,
    tone: "bg-info-soft text-info",
    tagline: "Sees their own clients",
    can: ["Own schedule & caseload", "Writes notes & care plans", "Messages their clients"],
    guard: "Notes stay private to them and their supervisor — no one else reads them.",
  },
  front_desk: {
    icon: CalendarDays,
    tone: "bg-surface-2 text-text-2",
    tagline: "Keeps the diary moving",
    can: ["Books & manages appointments", "Clients, rooms & intake", "Sees every schedule"],
    guard: "Never sees a clinical note or a payment.",
  },
  finance: {
    icon: Wallet,
    tone: "bg-warn-soft text-warn",
    tagline: "Handles the money",
    can: ["Invoices & payments", "Statements & reconciliation"],
    guard: "No clinical records, notes, or session detail at all.",
  },
  programme_manager: {
    icon: BarChart3,
    tone: "bg-surface-2 text-text-2",
    tagline: "Reports to funders",
    can: ["Aggregate reporting & funders", "Programme outcomes"],
    guard: "Sees numbers, never an identifiable client's clinical data.",
  },
};

const ORDER: TeamRole[] = ["org_admin", "counsellor", "front_desk", "finance", "programme_manager"];

export function RoleGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
          <Lock className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-text">How roles work</div>
          <div className="text-[12px] text-text-3">Each role reaches only what it needs — clinical notes stay with the counsellor.</div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-text-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="grid gap-2.5 border-t border-border bg-surface-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map((role) => {
            const m = ROLES[role];
            const Icon = m.icon;
            return (
              <div key={role} className="rounded-control border border-border bg-surface p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-control", m.tone)}>
                    <Icon className="size-4" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-text">{TEAM_ROLE_LABELS[role]}</div>
                    <div className="text-[11.5px] text-text-3">{m.tagline}</div>
                  </div>
                </div>
                <ul className="mt-3 space-y-1">
                  {m.can.map((c) => (
                    <li key={c} className="flex gap-1.5 text-[12px] text-text-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                      {c}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-1.5 rounded-[7px] bg-surface-2 px-2.5 py-2 text-[11.5px] text-text-2">
                  <Lock className="mt-0.5 size-3 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
                  <span>{m.guard}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
