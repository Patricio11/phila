"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand/aloe-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BASE_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "For funders", href: "#funders" },
  { label: "Trust", href: "#trust" },
  { label: "Who it's for", href: "#who" },
];

export function SiteNav({ showPricing = false }: { showPricing?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const LINKS = showPricing ? [...BASE_LINKS, { label: "Pricing", href: "#pricing" }] : BASE_LINKS;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border bg-surface/80 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Phila home">
          <BrandMark size={30} />
          <span className="text-[16px] font-[650] tracking-[-0.01em] text-text">Phila</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-control px-3 py-2 text-[13.5px] font-medium text-text-2 transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/signup">Get started</Link>
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <div
        className={cn(
          "overflow-hidden border-t border-border bg-surface transition-[max-height,opacity] duration-300 md:hidden",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-3">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-control px-3 py-2.5 text-[14px] font-medium text-text-2 hover:bg-surface-hover hover:text-text"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-2 flex gap-2">
            <Button asChild variant="ghost" size="sm" className="flex-1">
              <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
            </Button>
            <Button asChild size="sm" className="flex-1">
              <Link href="/signup" onClick={() => setOpen(false)}>Get started</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
