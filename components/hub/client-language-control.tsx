"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { LANGUAGES, languageName, GAP_HANDLING_LABELS } from "@/lib/domain/languages";
import { recordClientLanguage } from "@/app/hub/clients/actions";

/**
 * Phase 32.0 - language of record on the dossier. Also records how any
 * language gap is handled today (the safeguarding + funding datum).
 */
export function ClientLanguageControl({ clientId, firstName, homeLanguage, gapHandling, interpretationNeeded }: {
  clientId: string;
  firstName: string;
  homeLanguage: string | null;
  gapHandling: string | null;
  interpretationNeeded: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<string | null>(homeLanguage);
  const [gap, setGap] = useState<string | null>(gapHandling);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await recordClientLanguage({ clientId, homeLanguage: lang, gapHandling: gap });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Language recorded", description: lang ? `${firstName}'s sessions can now be matched by language.` : "Cleared." });
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[12.5px] text-text-2 hover:text-text">
        <Languages className="size-3.5 text-text-3" strokeWidth={2} aria-hidden />
        {homeLanguage ? (
          <>
            {languageName(homeLanguage)}
            {interpretationNeeded && <span className="rounded-chip bg-info-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-info">needs interpretation</span>}
          </>
        ) : (
          <span className="text-text-3 underline decoration-dotted underline-offset-2">Record language</span>
        )}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${firstName}'s language`}
        description="Their home language, and how any gap with the counsellor is handled today."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={save} loading={pending}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Home language</Label>
            <Select
              value={lang}
              onChange={setLang}
              placeholder="Choose a language"
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.nameNative, hint: l.tier === 3 ? "recorded only" : undefined }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>How is the gap handled today?</Label>
            <Select
              value={gap}
              onChange={setGap}
              placeholder="Choose one"
              options={Object.entries(GAP_HANDLING_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <p className="text-[11.5px] leading-relaxed text-text-3">
              A family member interpreting a counselling session is a safeguarding concern worth recording honestly.
            </p>
          </div>
        </div>
      </Dialog>
    </>
  );
}
