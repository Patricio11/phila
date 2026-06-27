"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  /** Hide the column below this breakpoint to stay readable on phones. */
  hideBelow?: "sm" | "md" | "lg";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  search?: { placeholder: string; getText: (row: T) => string };
  toolbar?: React.ReactNode;
  empty?: React.ReactNode;
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * DataTable (DESIGN.md §6)  quiet header, hover rows, sticky header, tabular
 * numerals, sortable, optional search + toolbar filters. Rows can be links. On
 * phones, secondary columns drop out (hideBelow) and the table scrolls.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  search,
  toolbar,
  empty,
}: DataTableProps<T>) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    if (!search || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => search.getText(r).toLowerCase().includes(q));
  }, [rows, search, query]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const sv = col.sortValue;
    return [...filtered].sort((a, b) => {
      const av = sv(a);
      const bv = sv(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, dir, columns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("asc");
    }
  };

  return (
    <div>
      {(search || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {search && (
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={search.placeholder}
                className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-[13.5px] text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3.5 py-2.5 text-[12px] font-semibold text-text-3",
                    col.align === "right" && "text-right",
                    col.hideBelow && HIDE[col.hideBelow],
                  )}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-text",
                        col.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        dir === "asc" ? (
                          <ChevronUp className="size-3.5" aria-hidden />
                        ) : (
                          <ChevronDown className="size-3.5" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3.5 py-10 text-center text-[13px] text-text-3">
                  {query.trim() ? "No matches." : (empty ?? "Nothing here yet.")}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const href = rowHref?.(row);
                return (
                  <tr
                    key={rowKey(row)}
                    // Mouse convenience: navigate on row click. Keyboard + screen
                    // readers use the real link the caller puts in the first cell.
                    onClick={href ? () => router.push(href) : undefined}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors hover:bg-surface-hover",
                      href && "cursor-pointer",
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3.5 py-3 align-middle text-[13.5px] text-text",
                          col.align === "right" && "text-right tabular-nums",
                          col.hideBelow && HIDE[col.hideBelow],
                          col.className,
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
