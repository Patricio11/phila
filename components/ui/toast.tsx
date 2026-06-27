"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast (DESIGN.md §6) — calm, honest, brief feedback. Quiet by default; success
 * leans on the accent, error on the measured rose. Auto-dismisses; the timer is
 * a no-op under reduced motion is unnecessary (it's just opacity), but entrance
 * motion is GPU-only and capped. Stacks bottom-centre on phones, bottom-right up.
 */
type ToastTone = "default" | "success" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContext {
  toast: (t: Omit<ToastItem, "id">) => void;
}

const Ctx = React.createContext<ToastContext | null>(null);

export function useToast(): ToastContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => remove(id), 4000);
  }, [remove]);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <Toaster items={items} onDismiss={remove} />
    </Ctx.Provider>
  );
}

const noopSubscribe = () => () => {};

function Toaster({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  // Portals need document.body — only present on the client. This returns false
  // on the server and true after hydration, with no effect-driven setState.
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      role="region"
      aria-label="Notifications"
    >
      {items.map((t) => (
        <Toast key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>,
    document.body,
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = item.tone === "success" ? Check : item.tone === "error" ? TriangleAlert : Info;
  const tone =
    item.tone === "success"
      ? "text-accent"
      : item.tone === "error"
        ? "text-danger"
        : "text-info";

  return (
    <div
      role="status"
      aria-live="polite"
      className="rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-border bg-surface p-3.5 shadow-[var(--shadow-card)]"
    >
      <span className={cn("mt-0.5 shrink-0", tone)} aria-hidden>
        <Icon className="size-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-[600] text-text">{item.title}</div>
        {item.description ? (
          <div className="mt-0.5 text-[12.5px] leading-snug text-text-2">{item.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="-m-1 shrink-0 rounded p-1 text-text-3 transition-colors hover:text-text"
        aria-label="Dismiss"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
