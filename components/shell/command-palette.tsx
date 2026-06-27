"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { NavSection } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

/**
 * Command palette (⌘K)  searches the current role's destinations and navigates.
 * Real, keyboard-driven: type to filter, ↑/↓ to move, Enter to go. Part B can
 * fold in client/record search behind the same surface.
 */
export function CommandPalette({
  open,
  onClose,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () => sections.flatMap((s) => s.items.filter((i) => i.ready ?? false).map((i) => ({ ...i, group: s.label }))),
    [sections],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    // Reset + focus on the next frame (deferred, so not a synchronous effect setState).
    const id = requestAnimationFrame(() => {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) go(item.href);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Search" className="sm:max-w-xl" >
      <div className="-mt-1">
        <div className="flex items-center gap-2.5 rounded-control border border-border bg-surface-2 px-3">
          <Search className="size-4 shrink-0 text-text-3" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search pages and actions…"
            className="h-11 w-full bg-transparent text-[14px] text-text placeholder:text-text-3 focus:outline-none"
            aria-label="Search"
          />
        </div>

        <ul className="mt-3 max-h-[50vh] space-y-0.5 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-2 py-6 text-center text-[13px] text-text-3">No matches.</li>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left text-[13.5px] transition-colors",
                      i === active ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[11px] text-text-3">{item.group}</span>
                    {i === active && <CornerDownLeft className="size-3.5 text-text-3" aria-hidden />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Dialog>
  );
}
