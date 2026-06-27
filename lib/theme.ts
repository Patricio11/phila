/**
 * Theme is **light + dark only**, light default, no "system" option — locked to
 * DESIGN.md §10. (The ROADMAP appendix's `theme` enum still lists `system`; the
 * design spec is the more recent, locked authority, so we ship two themes and
 * keep `system` trivial to add later if that decision is revisited.)
 *
 * The choice is persisted per user. In Part A that's `localStorage`; Part B
 * (Phase 9) moves the source of truth to the user record without touching the UI.
 */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "light";
export const THEME_STORAGE_KEY = "phila-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}
