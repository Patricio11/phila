"use client";

import { Bell, Menu, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * The top bar (DESIGN.md §5.2). 64px, sticky, translucent with a backdrop blur
 * so content scrolls cleanly under it. Page title + date on the left; search
 * pushed right; theme toggle; notifications (amber dot when there's something);
 * the account chip. The menu button reveals the sidebar drawer on phones.
 */
export function TopBar({
  title,
  date,
  user,
  hasNotifications = false,
  onOpenMobileNav,
}: {
  title: string;
  date: string;
  user: { name: string; roleLabel: string };
  hasNotifications?: boolean;
  onOpenMobileNav: () => void;
}) {
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
        {/* Search — ⌘K (wired in a later phase). */}
        <button
          type="button"
          className="hidden h-9 items-center gap-2 rounded-control border border-border bg-surface-2 px-2.5 text-[13px] text-text-3 transition-colors hover:border-border-strong sm:inline-flex"
          aria-label="Search"
        >
          <Search className="size-4" strokeWidth={1.9} aria-hidden />
          <span className="pr-6">Search</span>
          <kbd className="rounded bg-surface px-1.5 py-0.5 font-sans text-[11px] text-text-3 shadow-sm">
            ⌘K
          </kbd>
        </button>

        <ThemeToggle />

        <button
          type="button"
          className="relative inline-flex size-9 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
          aria-label={hasNotifications ? "Notifications — you have new items" : "Notifications"}
        >
          <Bell className="size-[18px]" strokeWidth={1.9} aria-hidden />
          {hasNotifications && (
            <span
              className={cn(
                "absolute right-2 top-2 size-2 rounded-full bg-warn ring-2 ring-surface",
              )}
              aria-hidden
            />
          )}
        </button>

        <div className="ml-1 flex items-center gap-2 rounded-pill border border-border bg-surface py-1 pl-1 pr-2.5">
          <Avatar name={user.name} size="sm" />
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="truncate text-[12.5px] font-medium text-text">{user.name}</span>
            <span className="truncate text-[11px] text-text-3">{user.roleLabel}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
