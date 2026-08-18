"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { TwoFactorBanner } from "@/components/shell/two-factor-banner";
import { NAVS, type NavKey, type NavSection } from "@/components/shell/nav-config";
import { PageHeadSetterContext, type HeadInfo } from "@/components/shell/page-head-context";
import { getUnreadMessages } from "@/lib/messaging/unread-actions";
import { heartbeat } from "@/lib/messaging/presence-actions";

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
  twoFactorPrompt = false,
  unreadMessages,
  children,
}: {
  navKey: NavKey;
  orgName: string;
  user: { name: string; email: string; roleLabel: string; photoUrl?: string | null };
  settingsHref?: string;
  /** Org feature flags  used to hide feature-gated nav items (e.g. Funders). */
  features?: Record<string, boolean>;
  /** Show the skippable 2FA nudge banner (privileged users without 2FA). */
  twoFactorPrompt?: boolean;
  /** Batch 2u - unread team messages at render time; the badge on Messages. */
  unreadMessages?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The count stays honest without a reload: refetch on a gentle interval and
  // whenever the tab comes back; land on Messages and it clears optimistically
  // (opening a thread marks it read server-side, so the next poll agrees).
  const [unread, setUnread] = useState(unreadMessages ?? 0);
  const onMessages = /^\/(app|hub|me)\/messages/.test(pathname);
  useEffect(() => {
    if (onMessages) setUnread(0);
  }, [onMessages]);
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      const res = await getUnreadMessages().catch(() => null);
      if (!stopped && res?.ok) setUnread(res.count);
    };
    const id = setInterval(() => void tick(), 30_000);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  // Phase 34.2 - presence heartbeat: "I'm here" every 60 s while the tab is
  // visible, so a Phila message never rings the phone of someone already in Phila.
  useEffect(() => {
    let stopped = false;
    const beat = () => { if (!stopped && !document.hidden) void heartbeat().catch(() => {}); };
    beat();
    const id = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => { stopped = true; clearInterval(id); document.removeEventListener("visibilitychange", beat); };
  }, []);
  const sections: NavSection[] = useMemo(
    () =>
      NAVS[navKey]
        .map((s) => ({
          ...s,
          items: s.items
            .filter((i) => !i.feature || features?.[i.feature])
            .map((i) => (i.href.endsWith("/messages") && unread > 0 && !onMessages ? { ...i, badge: unread } : i)),
        }))
        .filter((s) => s.items.length > 0),
    [navKey, features, unread, onMessages],
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

  // Batch 3o - the page's PageHead pushes its title + summary up here, so the
  // top bar carries the page identity once (summary where the date line was).
  const [head, setHead] = useState<HeadInfo | null>(null);
  const setHeadStable = useCallback((h: HeadInfo | null) => setHead(h), []);

  return (
    <PageHeadSetterContext.Provider value={setHeadStable}>
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
          title={head?.title ?? title}
          date={today}
          subtitle={head?.summary ?? null}
          user={user}
          sections={sections}
          settingsHref={settingsHref}
        />
        {twoFactorPrompt && <TwoFactorBanner />}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          {/* Bottom padding on mobile clears the floating tab bar + home-indicator safe area. */}
          <div className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] sm:px-6 sm:pt-8 lg:pb-8">{children}</div>
        </main>
      </div>

      {/* Mobile: a native floating tab bar + a "More" sheet (desktop uses the sidebar). */}
      <BottomNav sections={sections} settingsHref={settingsHref} />
    </div>
    </PageHeadSetterContext.Provider>
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
