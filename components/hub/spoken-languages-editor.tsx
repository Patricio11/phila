"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LanguageMultiSelect } from "@/components/ui/language-multi-select";
import { languageName } from "@/lib/domain/languages";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveSpokenLanguages } from "@/app/hub/team/actions";

/** Phase 32.0 - org-managed spoken languages on the team member page. */
export function SpokenLanguagesEditor({ counsellorId, firstName, initial }: {
  counsellorId: string;
  firstName: string;
  initial: string[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [codes, setCodes] = useState<string[]>(initial);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveSpokenLanguages({ counsellorId, codes });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Languages saved", description: `Booking now prefers ${firstName} for these languages.` });
      setEditing(false);
      router.refresh();
    });

  return (
    <div className="px-[17px] pb-[17px]">
      {editing ? (
        <div className="space-y-3">
          <LanguageMultiSelect value={codes} onChange={setCodes} />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={pending}>Save languages</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCodes(initial); setEditing(false); }} disabled={pending}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          {initial.length === 0 ? (
            <p className="text-[12.5px] text-text-2">No languages recorded yet - clients can't be matched to {firstName} by language.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {initial.map((c) => (
                <span key={c} className="rounded-chip bg-accent-soft px-2.5 py-1 text-[12.5px] font-medium text-accent">{languageName(c)}</span>
              ))}
            </div>
          )}
          <Button size="sm" variant="ghost" className="mt-2.5" onClick={() => setEditing(true)}>
            <Languages className="size-3.5" strokeWidth={2} aria-hidden /> Edit languages
          </Button>
        </>
      )}
    </div>
  );
}
