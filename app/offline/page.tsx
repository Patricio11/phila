import Link from "next/link";
import { CloudOff } from "lucide-react";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Offline" };

/**
 * The offline fallback the service worker serves when a navigation can't reach
 * the network. Calm and honest  it names the state and what still works, rather
 * than showing a browser error (Calm Feedback / Honesty).
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <BrandMark size={44} />
      <div className="mt-6 inline-flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-3">
        <CloudOff className="size-6" strokeWidth={1.9} aria-hidden />
      </div>
      <h1 className="mt-4 text-[21px] font-[680] tracking-[-0.025em]">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-text-2">
        Phila can&apos;t reach the network right now. Anything you started will be
        kept and sent the moment you&apos;re back online  nothing is lost.
      </p>
      <Button asChild variant="ghost" className="mt-6">
        <Link href="/app">Try again</Link>
      </Button>
    </main>
  );
}
