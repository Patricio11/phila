"use client";

import { useTransition } from "react";
import { MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendSetupLink } from "@/app/hub/team/actions";

export function SendSetupLinkButton({ userId, name, email }: { userId: string; name: string; email: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const res = await sendSetupLink({ userId });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `Setup link sent to ${name.split(" ")[0]}`, description: `${email} will get a link to set a password and sign in  once email is connected.` });
    });

  return (
    <Button variant="ghost" size="sm" onClick={send} loading={pending}>
      <MailPlus className="size-4" strokeWidth={2} aria-hidden /> Send setup link
    </Button>
  );
}
