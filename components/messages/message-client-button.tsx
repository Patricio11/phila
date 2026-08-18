"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { startClientThread } from "@/app/app/messages/actions";

/**
 * Phase 34.1 - "Message" on a client page. Opens (or reopens) THE practice <->
 * client conversation and lands on it. The practice always speaks first.
 */
export function MessageClientButton({ clientId, base, variant = "ghost", label = "Message" }: {
  clientId: string;
  /** Where the Messages page lives for this surface: "/hub/messages" or "/app/messages". */
  base: string;
  variant?: "ghost" | "primary";
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      loading={pending}
      onClick={() => start(async () => {
        const res = await startClientThread({ clientId });
        if (!res.ok) return toast({ tone: "error", title: "Can't open a conversation", description: res.error });
        router.push(`${base}?t=${encodeURIComponent(res.threadId)}`);
      })}
    >
      <MessageSquare className="size-4" strokeWidth={2} aria-hidden /> {label}
    </Button>
  );
}
