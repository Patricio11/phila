"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so Phila is installable with an offline shell.
 * Registration is skipped in development to avoid clashing with Turbopack HMR;
 * the production build is where "installable" is verified (DESIGN.md §8 gate).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure is non-fatal  the app works online regardless.
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
