import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarHeart,
  CreditCard,
  DoorOpen,
  FileText,
  House,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  PieChart,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

/**
 * Navigation is data, not markup — the same shell (DESIGN.md §5.4) renders every
 * role; only the nav contents change. `ready: false` items are part of the
 * design but land in a later phase: the shell shows them honestly as "Soon"
 * rather than as a dead-end link.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  ready?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Nav configs hold icon *components* (forwardRef objects), which cannot cross
 * the server→client boundary. So a Server Component never passes a config across
 * — it passes a `NavKey`, and the client shell resolves the config here.
 */
export type NavKey = "counsellor" | "client";

/** Counsellor workspace nav. Dashboard is the Phase-0 reference build. */
export const counsellorNav: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/app", icon: LayoutDashboard, ready: true },
      { label: "Calendar", href: "/app/calendar", icon: CalendarDays, ready: true },
      { label: "Clients", href: "/app/clients", icon: Users, ready: true },
      { label: "Sessions", href: "/app/sessions", icon: NotebookPen, ready: true },
      { label: "Messages", href: "/app/messages", icon: MessagesSquare },
    ],
  },
  {
    label: "Practice",
    items: [
      { label: "Supervision", href: "/app/supervision", icon: UserCog, ready: true },
      { label: "Rooms", href: "/app/rooms", icon: DoorOpen },
      { label: "Reports", href: "/app/reports", icon: PieChart },
      { label: "Billing", href: "/app/billing", icon: CreditCard },
    ],
  },
];

/** Client portal nav — the lightest shell (DESIGN.md §5.4). */
export const clientNav: NavSection[] = [
  {
    label: "Your space",
    items: [
      { label: "Home", href: "/me", icon: House, ready: true },
      { label: "Sessions", href: "/me/sessions", icon: CalendarHeart, ready: true },
      { label: "Documents", href: "/me/documents", icon: FileText, ready: true },
      { label: "Billing", href: "/me/billing", icon: CreditCard, ready: true },
      { label: "Consent", href: "/me/consent", icon: ShieldCheck, ready: true },
    ],
  },
];

export const NAVS: Record<NavKey, NavSection[]> = {
  counsellor: counsellorNav,
  client: clientNav,
};
