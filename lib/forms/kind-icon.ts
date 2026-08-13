import { ClipboardList, HeartHandshake, MessagesSquare, ShieldCheck, FileText, type LucideIcon } from "lucide-react";
import type { FormKind } from "@/lib/domain/enums";

/** The icon and plain name a form kind wears wherever forms are picked from. */
export const FORM_KIND_META: Record<FormKind, { icon: LucideIcon; label: string }> = {
  intake: { icon: ClipboardList, label: "Intake" },
  screening: { icon: HeartHandshake, label: "Screening" },
  feedback: { icon: MessagesSquare, label: "Feedback" },
  consent: { icon: ShieldCheck, label: "Consent" },
  custom: { icon: FileText, label: "Form" },
};
