"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { NAVS, type NavKey, type NavSection } from "@/components/shell/nav-config";

const COLLAPSE_KEY = "phila-sidebar-collapsed";
const COLLAPSE_EVENT = "phila:sidebar";
const EXPANDED_W = 248;
const COLLAPSED_W = 72;

/** The collapse preference is an external store (localStorage), read flash-free.
 *  With no saved preference yet, start **collapsed on smaller screens** (tablets,
 *  small laptops, landscape phones) and expanded only on wide desktops  so the
 *  sidebar never dominates a small viewport on first login. Once the user toggles,
 *  their choice is saved and wins. */
function readCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved !== null) return saved === "1";
    return window.matchMedia("(max-width: 1279px)").matches;
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
 * The app shell  the same structure for every role (DESIGN.md §5). A smooth
 * collapsible sidebar on desktop, an overlay drawer on phones, a sticky top bar,
 * and a content area that breathes. The page title is derived from the active
 * nav item so pages don't have to thread it through.
 */
export function AppShell({
  navKey,
  orgName,
  user,
  settingsHref,
  features,
  children,
}: {
  navKey: NavKey;
  orgName: string;
  user: { name: string; email: string; roleLabel: string };
  settingsHref?: string;
  /** Org feature flags  used to hide feature-gated nav items (e.g. Funders). */
  features?: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const sections: NavSection[] = useMemo(
    () =>
      NAVS[navKey]
        .map((s) => ({ ...s, items: s.items.filter((i) => !i.feature || features?.[i.feature]) }))
        .filter((s) => s.items.length > 0),
    [navKey, features],
  );
  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapsed, () => false);

  const toggleCollapse = () => {
    const next = !readCollapsed();
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* storage disabled  preference simply won't persist */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };

  const title = useMemo(() => deriveTitle(sections, pathname), [sections, pathname]);
  const today = useMemo(() => formatToday(), []);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-accent-ink"
      >
        Skip to content
      </a>
      {/* Desktop sidebar  width animates smoothly on collapse. */}
      <aside
        className="hidden shrink-0 border-r border-border transition-[width] duration-300 ease-[cubic-bezier(.2,0,0,1)] lg:block"
        style={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      >
        <Sidebar
          sections={sections}
          orgName={orgName}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          settingsHref={settingsHref}
        />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          date={today}
          user={user}
          sections={sections}
          settingsHref={settingsHref}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          {/* Bottom padding on mobile clears the floating tab bar + home-indicator safe area. */}
          <div className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] sm:px-6 sm:pt-8 lg:pb-8">{children}</div>
        </main>
      </div>

      {/* Mobile: a native floating tab bar + a "More" sheet (desktop uses the sidebar). */}
      <BottomNav sections={sections} settingsHref={settingsHref} />
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
