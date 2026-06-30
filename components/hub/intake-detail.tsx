"use client";

import { CheckCircle2, FileText, Send } from "lucide-react";
import type { IntakeForm } from "@/lib/domain/types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

function fullDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * Intake detail  what the form *asks*, and (when completed) what the client
 * *answered*. This is the "outcome" of an intake: the counsellor reads it to
 * prepare for the first session. Form-only mode is the blank-form preview.
 */
export function IntakeDetail({
  open,
  onClose,
  form,
  clientName,
  status,
  submittedAt,
  answers,
  onSend,
  sending,
}: {
  open: boolean;
  onClose: () => void;
  form: IntakeForm | null;
  clientName?: string;
  status?: "completed" | "sent" | "not_sent";
  submittedAt?: string | null;
  answers?: Record<string, string> | null;
  onSend?: () => void;
  sending?: boolean;
}) {
  const completed = status === "completed" && answers;
  const title = clientName ? `${clientName.split(" ")[0]}'s intake` : "Intake form";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={completed ? undefined : form?.intro}
      footer={
        clientName && !completed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-text-3">{status === "sent" ? "Sent  awaiting their answers" : "Not sent yet"}</span>
            <Button onClick={onSend} loading={sending}>
              <Send className="size-4" strokeWidth={2} aria-hidden /> {status === "sent" ? "Resend form" : "Send form"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
        )
      }
    >
      {completed && submittedAt && (
        <div className="mb-4 flex items-center gap-2 rounded-control border border-accent/25 bg-accent-soft/40 px-3 py-2 text-[12.5px] text-text-2">
          <CheckCircle2 className="size-4 text-accent" strokeWidth={2} aria-hidden /> Submitted {fullDate(submittedAt)}
        </div>
      )}

      {!form ? (
        <p className="text-[13px] text-text-3">No intake form is set up for this practice yet.</p>
      ) : (
        <ol className="space-y-3.5">
          {form.fields.map((f) => {
            const answer = answers?.[f.id];
            return (
              <li key={f.id}>
                <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-2">
                  {f.label}{f.required && <span className="text-danger">*</span>}
                  {f.sensitive && <Tag tone="neutral">Confidential</Tag>}
                </div>
                {completed ? (
                  <div className={cn("mt-1 rounded-control border border-border bg-surface-2/40 px-3 py-2 text-[13.5px]", answer ? "text-text" : "italic text-text-3")}>
                    {answer || "Left blank"}
                  </div>
                ) : (
                  <div className="mt-1 text-[12px] text-text-3">
                    {f.type === "radio" && f.options ? (
                      <span className="flex flex-wrap gap-1.5">{f.options.map((o) => <span key={o} className="rounded-chip border border-border px-2 py-0.5">{o}</span>)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" strokeWidth={2} aria-hidden /> {f.type === "textarea" ? "Free text" : f.type === "tel" ? "Phone number" : f.type === "email" ? "Email" : "Short text"}{f.help ? ` · ${f.help}` : ""}</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Dialog>
  );
}
