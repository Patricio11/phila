"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary (DESIGN.md §6) — calm and specific, not apologetic. Offers a way
 * forward (retry) rather than a dead end. Real errors are reported in Part B.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[19px] font-[680] tracking-[-0.02em] text-text">Something didn&apos;t load</h1>
      <p className="mt-2 max-w-sm text-[13.5px] text-text-2">
        That part of Phila hit a snag. Your data is safe — try again, and it should come right.
      </p>
      <Button className="mt-5" onClick={reset}>
        <RotateCcw className="size-4" strokeWidth={2} aria-hidden /> Try again
      </Button>
    </div>
  );
}
