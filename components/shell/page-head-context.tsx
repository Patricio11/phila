"use client";

import { createContext, useContext } from "react";

/**
 * Batch 3o - one title, one place. Every page's PageHead used to render a
 * second heading under the top bar that repeated the bar's title. Now the
 * shell owns a head slot: PageHead pushes its title + summary up into the
 * top bar (replacing the date line with the page description) and keeps only
 * its action buttons in the body. Pages outside the shell (no provider) fall
 * back to rendering in place.
 */
export interface HeadInfo {
  title: React.ReactNode;
  summary?: React.ReactNode;
}

export const PageHeadSetterContext = createContext<((h: HeadInfo | null) => void) | null>(null);

export function usePageHeadSetter() {
  return useContext(PageHeadSetterContext);
}
