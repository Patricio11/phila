"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { NAVS, type NavKey, type NavSection } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "phila-sidebar-collapsed";
const COLLAPSE_EVENT = "phila:sidebar";
const EXPANDED_W = 248;
const COLLAPSED_W = 72;

/** The collapse preference is an external store (localStorage), read flash-free. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapse(onChange: () => void) {
  const handler = (e: StorageEvent | Event) => {
    if (e instanceof StorageEvent && e.key !== COLLAPSE_KEY) return;
    onChange();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(COLLAPSE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(COLLAPSE_EVENT, handler);
  };
}

/**
 * The app shell — the same structure for every role (DESIGN.md §5). A smooth
 * collapsible sidebar on desktop, an overlay drawer on phones, a sticky top bar,
 * and a content area that breathes. The page title is derived from the active
 * nav item so pages don't have to thread it through.
 */
export function AppShell({
  navKey,
  orgName,
  user,
  hasNotifications,
  children,
}: {
  navKey: NavKey;
  orgName: string;
  user: { name: string; roleLabel: string };
  hasNotifications?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const sections: NavSection[] = NAVS[navKey];
  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = () => {
    const next = !readCollapsed();
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* storage disabled — preference simply won't persist */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };

  const title = useMemo(() => deriveTitle(sections, pathname), [sections, pathname]);
  const today = useMemo(() => formatToday(), []);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {/* Desktop sidebar — width animates smoothly on collapse. */}
      <aside
        className="hidden shrink-0 border-r border-border transition-[width] duration-300 ease-[cubic-bezier(.2,0,0,1)] lg:block"
        style={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      >
        <Sidebar
          sections={sections}
          orgName={orgName}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-[248px] border-r border-border shadow-[var(--shadow-card)] transition-transform duration-300 ease-[cubic-bezier(.2,0,0,1)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar
            sections={sections}
            orgName={orgName}
            collapsed={false}
            onToggleCollapse={() => setMobileOpen(false)}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          date={today}
          user={user}
          hasNotifications={hasNotifications}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function deriveTitle(sections: NavSection[], pathname: string): string {
  const items = sections.flatMap((s) => s.items);
  // Longest matching href wins (so /app/clients beats /app, /me/sessions beats /me).
  const match = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Phila";
}

function formatToday(): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}
