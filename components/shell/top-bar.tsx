"use client";

import { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CommandPalette } from "@/components/shell/command-palette";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { AccountMenu } from "@/components/shell/account-menu";
import type { NavSection } from "@/components/shell/nav-config";

/**
 * The top bar (DESIGN.md §5.2). 64px, sticky, translucent. The search opens the
 * ⌘K command palette; the bell opens notifications; the account chip opens the
 * account menu  all real and keyboard-reachable.
 */
export function TopBar({
  title,
  date,
  user,
  sections,
  settingsHref,
  onOpenMobileNav,
}: {
  title: string;
  date: string;
  user: { name: string; email: string; roleLabel: string };
  sections: NavSection[];
  settingsHref?: string;
  onOpenMobileNav: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl-K opens the palette anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="-ml-1 inline-flex size-9 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" strokeWidth={1.9} aria-hidden />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-[650] tracking-[-0.01em] text-text">{title}</h1>
        <p className="truncate text-[12px] text-text-3">{date}</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden h-9 items-center gap-2 rounded-control border border-border bg-surface-2 px-2.5 text-[13px] text-text-3 transition-colors hover:border-border-strong hover:text-text-2 sm:inline-flex"
          aria-label="Search (Command or Control K)"
        >
          <Search className="size-4" strokeWidth={1.9} aria-hidden />
          <span className="pr-6">Search</span>
          <kbd className="rounded bg-surface px-1.5 py-0.5 font-sans text-[11px] text-text-3 shadow-sm">⌘K</kbd>
        </button>

        {/* Mobile search icon */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text sm:hidden"
          aria-label="Search"
        >
          <Search className="size-[18px]" strokeWidth={1.9} aria-hidden />
        </button>

        <ThemeToggle />
        <NotificationsMenu />
        <AccountMenu name={user.name} email={user.email} roleLabel={user.roleLabel} settingsHref={settingsHref} />
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} sections={sections} />
    </header>
  );
}
