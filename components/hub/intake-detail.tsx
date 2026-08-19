"use client";

import { CheckCircle2, FileDown, Send } from "lucide-react";
import type { IntakeForm } from "@/lib/domain/types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormFields } from "@/components/forms/form-fields";
import { downloadResponsePdf, type DocBrand } from "@/lib/export/response-pdf";
import { ResponseView } from "@/components/forms/response-view";

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
  brand = null,
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
  /** Batch 4q - logo / accent / footer: the answers read as the practice's document. */
  brand?: DocBrand | null;
}) {
  const completed = status === "completed" && answers;
  const title = !clientName ? "Intake form" : /share link/i.test(clientName) ? "Shared-link response" : `${clientName.split(" ")[0]}'s intake`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="sm:max-w-3xl"
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
          <div className="flex items-center justify-end gap-2">
            {completed && form && (
              <Button
                variant="ghost"
                onClick={() => downloadResponsePdf({ formTitle: form.title, respondent: clientName ?? null, submittedAt: submittedAt ?? null, fields: form.fields, answers: answers ?? {}, brand })}
              >
                <FileDown className="size-4" strokeWidth={2} aria-hidden /> Download PDF
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
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
      ) : completed ? (
        <ResponseView fields={form.fields} answers={answers ?? {}} formTitle={form.title} brand={brand} respondent={clientName ?? null} submittedAt={submittedAt ?? null} />
      ) : (
        // Blank-form preview  rendered exactly as a client sees it (read-only).
        <FormFields fields={form.fields} readOnly idPrefix="preview" />
      )}
    </Dialog>
  );
}
