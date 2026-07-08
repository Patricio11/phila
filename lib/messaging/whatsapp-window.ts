/**
 * WhatsApp's 24-hour customer-service window (WhatsApp-first comms).
 *
 * Meta lets a business send FREE-FORM messages only within 24h of the client's
 * last inbound message — and that window is FREE (no per-message fee). Outside it,
 * only a pre-approved *template* message may be sent (a small Meta utility fee).
 * We track each client's last inbound message and route accordingly, so reminders
 * always land: free-form when the window is open, an approved template when it's
 * closed — and honestly nothing (never a Meta-rejected free-form) when neither is
 * possible. Pure + unit-tested; no I/O.
 */
import { phoneKey } from "@/lib/import/validate";
import type { RenderVars } from "@/lib/messaging/templates";

export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

const ms = (v: Date | string | number): number => (v instanceof Date ? v.getTime() : new Date(v).getTime());

/** Is the free 24h service window open? Needs a prior inbound message; false if none. */
export function whatsappWindowOpen(lastInboundAt: Date | string | null | undefined, now: Date | string): boolean {
  if (!lastInboundAt) return false;
  return ms(now) - ms(lastInboundAt) < WHATSAPP_WINDOW_MS;
}

/** Whole hours left in the free window (0 when closed) — for the settings/composer UI. */
export function whatsappWindowHoursLeft(lastInboundAt: Date | string | null | undefined, now: Date | string): number {
  if (!lastInboundAt) return 0;
  const left = WHATSAPP_WINDOW_MS - (ms(now) - ms(lastInboundAt));
  return left <= 0 ? 0 : Math.ceil(left / (60 * 60 * 1000));
}

export type WhatsappSendMode = "free_form" | "template" | "window_closed";

/**
 * How a WhatsApp send should be transmitted given the window + whether the trigger
 * has an approved template configured. `window_closed` means we must NOT send (Meta
 * rejects free-form outside the window and there's no template to fall back to).
 */
export function decideWhatsappSend(opts: { windowOpen: boolean; hasTemplate: boolean }): WhatsappSendMode {
  if (opts.windowOpen) return "free_form"; // free
  if (opts.hasTemplate) return "template"; // approved template re-opens the window (small fee)
  return "window_closed";
}

/**
 * The canonical positional parameters ({{1}}, {{2}}, …) passed to an org's approved
 * WhatsApp template, in a FIXED, documented order so orgs author a matching body.
 * Documented in the template manager so {{1}}..{{6}} always mean the same thing.
 */
export const WHATSAPP_TEMPLATE_PARAM_KEYS = ["clientName", "practiceName", "serviceName", "counsellorName", "date", "time"] as const satisfies readonly (keyof RenderVars)[];

export function orderedTemplateParams(vars: RenderVars): string[] {
  return WHATSAPP_TEMPLATE_PARAM_KEYS.map((k) => String(vars[k] ?? ""));
}

/** Canonical window key for a phone (last-9 SA digits — matches inbound wa_id to a stored client phone). */
export function windowKey(phone: string | null | undefined): string | null {
  return phoneKey(phone);
}
