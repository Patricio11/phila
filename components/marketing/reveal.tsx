"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-reveal  the marketing motion island (DESIGN.md §4: CSS-first + a tiny
 * JS island, GPU-only, capped, reduced-motion aware). It only toggles a class;
 * the easing lives in CSS. Reveals once, then disconnects. `delay` staggers
 * siblings; `soft` is a gentler rise for dense areas.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  soft = false,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  soft?: boolean;
  as?: "div" | "section" | "li" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No observer support (very old browser): reveal on the next frame so content
    // is never left hidden  deferred, so it's not a synchronous effect setState.
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cn("reveal", soft && "reveal-soft", visible && "is-visible", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
