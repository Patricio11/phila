import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  Bot,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  ClipboardList,
  Contact,
  CreditCard,
  DoorOpen,
  FileText,
  FolderClosed,
  HandCoins,
  HeartHandshake,
  House,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  PieChart,
  ReceiptText,
  TrendingUp,
  ScrollText,
  FileCheck,
  ShieldCheck,
  Sprout,
  Target,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Navigation is data, not markup  the same shell (DESIGN.md §5.4) renders every
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
 *  it passes a `NavKey`, and the client shell resolves the config here.
 */
export type NavKey = "counsellor" | "client" | "hub" | "funder" | "admin";

/** Counsellor workspace nav. Dashboard is the Phase-0 reference build. */
export const counsellorNav: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/app", icon: LayoutDashboard, ready: true },
      { label: "Appointments", href: "/app/appointments", icon: CalendarDays, ready: true },
      { label: "Clients", href: "/app/clients", icon: Users, ready: true },
      { label: "Sessions", href: "/app/sessions", icon: NotebookPen, ready: true },
      { label: "Messages", href: "/app/messages", icon: MessagesSquare, ready: true },
      { label: "Supervision", href: "/app/supervision", icon: UserCog, ready: true },
      { label: "Rooms", href: "/app/rooms", icon: DoorOpen, ready: true },
    ],
  },
];

/** Client portal nav  the lightest shell (DESIGN.md §5.4). */
export const clientNav: NavSection[] = [
  {
    label: "Your space",
    items: [
      { label: "Home", href: "/me", icon: House, ready: true },
      { label: "Your steps", href: "/me/steps", icon: Sprout, ready: true },
      { label: "Sessions", href: "/me/sessions", icon: CalendarHeart, ready: true },
      { label: "Documents", href: "/me/documents", icon: FileText, ready: true },
      { label: "Billing", href: "/me/billing", icon: CreditCard, ready: true },
      { label: "Consent", href: "/me/consent", icon: ShieldCheck, ready: true },
      { label: "Profile", href: "/me/profile", icon: UserRound, ready: true },
    ],
  },
];

/** Org-admin Hub nav (DESIGN.md §5.4). */
export const hubNav: NavSection[] = [
  {
    label: "Oversight",
    items: [
      { label: "Overview", href: "/hub", icon: LayoutDashboard, ready: true },
      { label: "Appointments", href: "/hub/appointments", icon: CalendarDays, ready: true },
      { label: "Clients", href: "/hub/clients", icon: Contact, ready: true },
      { label: "Insights", href: "/hub/insights", icon: TrendingUp, ready: true },
      { label: "Reporting", href: "/hub/reporting", icon: PieChart, ready: true },
      { label: "Funders & grants", href: "/hub/funders", icon: HandCoins, ready: true },
    ],
  },
  {
    label: "Run the practice",
    items: [
      { label: "Team", href: "/hub/team", icon: Users, ready: true },
      { label: "Messages", href: "/hub/messages", icon: MessagesSquare, ready: true },
      { label: "Rooms", href: "/hub/rooms", icon: DoorOpen, ready: true },
      { label: "Services", href: "/hub/services", icon: HeartHandshake, ready: true },
      { label: "Documents", href: "/hub/documents", icon: FolderClosed, ready: true },
      { label: "Booking", href: "/hub/booking", icon: CalendarCheck, ready: true },
      { label: "Intake", href: "/hub/intake", icon: ClipboardList, ready: true },
      { label: "Invoicing", href: "/hub/invoicing", icon: ReceiptText, ready: true },
      { label: "Billing & usage", href: "/hub/billing", icon: Wallet, ready: true },
    ],
  },
];

/** Funder portal nav  pared back; only their grant(s), read-only (DESIGN.md §5.4). */
export const funderNav: NavSection[] = [
  {
    label: "Your grants",
    items: [{ label: "My grants", href: "/funder", icon: Target, ready: true }],
  },
];

/** Super-admin platform console nav (DESIGN.md §5.4). */
export const adminNav: NavSection[] = [
  {
    label: "Platform",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard, ready: true },
      { label: "Organisations", href: "/admin/orgs", icon: Building2, ready: true },
      { label: "Onboarding", href: "/admin/onboarding", icon: FileCheck, ready: true },
      { label: "Plans & billing", href: "/admin/plans", icon: CreditCard, ready: true },
    ],
  },
  {
    label: "Rails & trust",
    items: [
      { label: "AI rail", href: "/admin/ai", icon: Bot, ready: true },
      { label: "Integrations", href: "/admin/integrations", icon: Blocks, ready: true },
      { label: "Audit", href: "/admin/audit", icon: ScrollText, ready: true },
    ],
  },
];

export const NAVS: Record<NavKey, NavSection[]> = {
  counsellor: counsellorNav,
  client: clientNav,
  hub: hubNav,
  funder: funderNav,
  admin: adminNav,
};
