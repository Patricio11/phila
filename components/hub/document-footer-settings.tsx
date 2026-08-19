"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveOrgDocumentFooter } from "@/app/hub/settings/actions";

/**
 * Batch 4q - the one line at the foot of every page of the practice's printed
 * documents (exported forms, on-screen form documents): NPO number · address ·
 * email. Blank = Phila composes it from the organisation profile; a form may
 * override it on its Design tab.
 */
export function DocumentFooterSettings({ initial, composed }: { initial: string | null; composed: string }) {
  const { toast } = useToast();
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const res = await saveOrgDocumentFooter({ footer: value });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Document footer saved", description: value.trim() ? "Printed at the foot of every page." : "Phila will compose it from your profile." });
  });
  return (
    <div className="space-y-2" data-testid="document-footer">
      <div className="flex items-center gap-2 text-[13px] font-[640] text-text"><FileText className="size-4 text-accent" strokeWidth={2} aria-hidden /> Document footer</div>
      <p className="text-[12px] leading-relaxed text-text-2">One line at the foot of every page of your printed forms - registration number, address, email. Leave it blank to use the line Phila composes from your organisation profile; any single form can override it on its Design tab.</p>
      <div className="space-y-1.5">
        <Label htmlFor="doc-footer">Footer line</Label>
        <Input id="doc-footer" value={value} onChange={(e) => setValue(e.target.value)} placeholder={composed || "174-733 NPO | 145 Sir Lowry Road, Woodstock 7925 | info@yourpractice.org.za"} maxLength={240} />
        <p className="text-[11px] text-text-3">{value.trim() ? "Your own line." : composed ? <>Composed from your profile: <span className="text-text-2">{composed}</span></> : "Add your registration number, address or email under Organisation → Profile and Phila composes this for you."}</p>
      </div>
      <div className="flex justify-end"><Button size="sm" onClick={save} loading={pending}>Save footer</Button></div>
    </div>
  );
}
