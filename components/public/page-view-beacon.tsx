"use client";

import { useEffect } from "react";

/**
 * PII-free page-view beacon (Phase 17). Fires once on mount so view counts work
 * even though the page is statically rendered (ISR). Sends only the org slug  no
 * visitor data, no cookies.
 */
export function PageViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const body = JSON.stringify({ slug, kind: "view" });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/public-events", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/public-events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
    } catch {
      /* analytics must never affect the visitor */
    }
  }, [slug]);
  return null;
}
