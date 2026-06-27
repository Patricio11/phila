"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme/use-theme";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Account menu — name/email, switch theme, settings, and sign out. Sign out is
 * mock in Part A (returns to the landing); Phase 9 calls Better Auth signOut.
 */
export function AccountMenu({
  name,
  email,
  roleLabel,
  settingsHref,
}: {
  name: string;
  email: string;
  roleLabel: string;
  settingsHref?: string;
}) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const signOut = () =>
    start(() => {
      toast({ tone: "default", title: "Signed out" });
      setOpen(false);
      router.push("/");
    });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="ml-1 flex items-center gap-2 rounded-pill border border-border bg-surface py-1 pl-1 pr-2 transition-colors hover:bg-surface-hover"
      >
        <Avatar name={name} size="sm" />
        <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
          <span className="truncate text-[12.5px] font-medium text-text">{name}</span>
          <span className="truncate text-[11px] text-text-3">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden size-3.5 text-text-3 sm:block" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 border-b border-border px-3.5 py-3">
            <Avatar name={name} size="md" />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-[600] text-text">{name}</div>
              <div className="truncate text-[11.5px] text-text-3">{email}</div>
            </div>
          </div>
          <div className="p-1">
            <MenuItem onClick={toggle} icon={theme === "dark" ? Sun : Moon}>
              Switch to {theme === "dark" ? "light" : "dark"} theme
            </MenuItem>
            {settingsHref ? (
              <MenuLink href={settingsHref} icon={Settings} onNavigate={() => setOpen(false)}>Settings</MenuLink>
            ) : (
              <MenuItem onClick={() => { setOpen(false); toast({ tone: "default", title: "Profile", description: "Your profile lives here once accounts are live." }); }} icon={UserRound}>
                Profile
              </MenuItem>
            )}
          </div>
          <div className="border-t border-border p-1">
            <MenuItem onClick={signOut} icon={LogOut} disabled={pending} danger>Sign out</MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, icon: Icon, onClick, danger, disabled }: { children: React.ReactNode; icon: typeof Settings; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] transition-colors disabled:opacity-50",
        danger ? "text-danger hover:bg-danger-soft/60" : "text-text-2 hover:bg-surface-hover hover:text-text",
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
      {children}
    </button>
  );
}

function MenuLink({ children, icon: Icon, href, onNavigate }: { children: React.ReactNode; icon: typeof Settings; href: string; onNavigate: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
      <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
      {children}
    </Link>
  );
}
