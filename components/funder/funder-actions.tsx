"use client";

import { useTransition } from "react";
import { Download, FileText, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { exportGrantReport } from "@/app/hub/grants/[id]/actions";

export function InviteFunderButton() {
  const { toast } = useToast();
  return (
    <Button
      onClick={() => toast({ tone: "default", title: "Invite a funder", description: "Send a scoped, read-only invite to one or more grants." })}
    >
      <UserPlus className="size-4" strokeWidth={2} aria-hidden /> Invite funder
    </Button>
  );
}

export function ReportExport({ grantId }: { grantId: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (format: "pdf" | "csv") =>
    start(async () => {
      await exportGrantReport({ grantId, format });
      toast({ tone: "success", title: `Period report exported (${format.toUpperCase()})`, description: "k-anonymised — nothing identifiable, mapped to the funder's template." });
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" onClick={() => run("csv")} loading={pending}>
        <Download className="size-4" strokeWidth={2} aria-hidden /> CSV
      </Button>
      <Button onClick={() => run("pdf")} loading={pending}>
        <FileText className="size-4" strokeWidth={2} aria-hidden /> Funder report (PDF)
      </Button>
    </div>
  );
}
