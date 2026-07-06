"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, Check, Clock, FileCheck2, Info, ShieldCheck, TriangleAlert, Upload, Download, Loader2 } from "lucide-react";
import type { OrgOnboardingData, OnboardingDocRow } from "@/db/queries/onboarding";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveCompanyProfile, requestOnboardingUpload, confirmOnboardingUpload, submitOnboarding, signOnboardingDocDownload } from "@/app/hub/verification/actions";
import { cn } from "@/lib/utils";

/** The company-profile fields. `req` ones must be filled before submitting. */
const FIELDS: { key: string; label: string; placeholder: string; req?: boolean; wide?: boolean }[] = [
  { key: "registrationNo", label: "Company / NPO registration no.", placeholder: "e.g. 2019/123456/07", req: true },
  { key: "vatNo", label: "VAT number", placeholder: "If VAT-registered" },
  { key: "taxNo", label: "Income tax number", placeholder: "SARS tax reference" },
  { key: "practiceNo", label: "HPCSA practice number", placeholder: "Practice registration" },
  { key: "infoOfficerName", label: "POPIA Information Officer", placeholder: "Full name", req: true },
  { key: "infoOfficerEmail", label: "Information Officer email", placeholder: "officer@practice.co.za", req: true },
  { key: "phone", label: "Practice phone", placeholder: "011 234 5678" },
  { key: "website", label: "Website", placeholder: "www.practice.co.za" },
  { key: "physicalAddress", label: "Physical address", placeholder: "Street, suburb, city, code", req: true, wide: true },
  { key: "postalAddress", label: "Postal address", placeholder: "If different from physical", wide: true },
];

function StatusBanner({ status }: { status: string }) {
  const map: Record<string, { icon: typeof ShieldCheck; tone: string; title: string; body: string }> = {
    verified: { icon: BadgeCheck, tone: "border-accent/30 bg-accent-soft/40 text-accent", title: "Verified", body: "Your practice is verified — payouts and funder reporting are unlocked." },
    submitted: { icon: Clock, tone: "border-info/30 bg-info-soft/40 text-info", title: "Under review", body: "Thanks — we're reviewing your details. We'll email you the moment it's approved." },
    action_needed: { icon: TriangleAlert, tone: "border-warn/40 bg-warn-soft/50 text-warn", title: "Action needed", body: "One or more items need another look — see the notes below, then resubmit." },
    not_started: { icon: ShieldCheck, tone: "border-border bg-surface-2/50 text-text-2", title: "Get verified", body: "Complete your company profile and upload your documents to unlock payouts and funder reporting. This doesn't affect your free trial." },
  };
  const s = map[status] ?? map.not_started!;
  const Icon = s.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-card border p-4", s.tone)}>
      <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={2} aria-hidden />
      <div className="min-w-0">
        <div className="text-[14px] font-[640] text-text">{s.title}</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-2">{s.body}</p>
      </div>
    </div>
  );
}

export function CompanyVerification({ data }: { data: OrgOnboardingData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [savingProfile, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const [name, setName] = useState(data.name);
  const [profile, setProfile] = useState<Record<string, string>>(data.profile);
  const set = (k: string, v: string) => setProfile((p) => ({ ...p, [k]: v }));

  const readOnly = data.status === "submitted" || data.status === "verified";

  const missingFields = FIELDS.filter((f) => f.req && !(profile[f.key] ?? "").trim()).length + (name.trim().length < 2 ? 1 : 0);
  const requiredDocs = data.docs.filter((d) => d.required);
  const docsDone = requiredDocs.filter((d) => d.status === "verified" || d.status === "pending").length;
  const canSubmit = missingFields === 0 && docsDone === requiredDocs.length && !readOnly;

  const saveProfile = () => startSave(async () => {
    const res = await saveCompanyProfile({
      name: name.trim(),
      registrationNo: profile.registrationNo ?? "", vatNo: profile.vatNo ?? "", taxNo: profile.taxNo ?? "",
      practiceNo: profile.practiceNo ?? "", infoOfficerName: profile.infoOfficerName ?? "", infoOfficerEmail: profile.infoOfficerEmail ?? "",
      phone: profile.phone ?? "", website: profile.website ?? "", physicalAddress: profile.physicalAddress ?? "", postalAddress: profile.postalAddress ?? "",
    });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Company profile saved" });
    router.refresh();
  });

  const submit = () => startSubmit(async () => {
    const res = await submitOnboarding();
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Submitted for review", description: "We'll email you once it's approved." });
    router.refresh();
  });

  return (
    <div className="space-y-5">
      <StatusBanner status={data.status} />

      {/* Company information */}
      <section className="rounded-card border border-border bg-surface p-5">
        <header className="mb-4 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-control bg-accent-soft text-accent"><Building2 className="size-4" strokeWidth={2} aria-hidden /></span>
          <div>
            <h2 className="text-[14.5px] font-[640] text-text">Company information</h2>
            <p className="text-[12px] text-text-3">Your registered details — used on invoices, funder reports, and payouts.</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Registered company / organisation name{<span className="text-warn"> *</span>}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} placeholder="As registered with CIPC / DSD" />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className={cn("space-y-1.5", f.wide && "sm:col-span-2")}>
              <Label>{f.label}{f.req ? <span className="text-warn"> *</span> : null}</Label>
              <Input value={profile[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} disabled={readOnly} placeholder={f.placeholder} inputMode={f.key === "infoOfficerEmail" ? "email" : undefined} />
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-text-3"><span className="text-warn">*</span> required to submit</p>
            <Button onClick={saveProfile} loading={savingProfile} variant="ghost">Save company profile</Button>
          </div>
        )}
      </section>

      {/* Required documents */}
      <section className="rounded-card border border-border bg-surface p-5">
        <header className="mb-4 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-control bg-accent-soft text-accent"><FileCheck2 className="size-4" strokeWidth={2} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14.5px] font-[640] text-text">Verification documents</h2>
            <p className="text-[12px] text-text-3">Upload the documents your platform administrator requires (PDF, PNG or JPG).</p>
          </div>
          <span className="shrink-0 text-[12px] font-medium text-text-2">{docsDone}/{requiredDocs.length} required</span>
        </header>

        {data.docs.length === 0 ? (
          <p className="rounded-control bg-surface-2/50 px-4 py-3 text-[12.5px] text-text-3">No documents are required right now.</p>
        ) : (
          <ul className="space-y-2">
            {data.docs.map((d) => (
              <DocRow key={d.requirementId} doc={d} readOnly={readOnly} />
            ))}
          </ul>
        )}
      </section>

      {/* Submit */}
      {!readOnly && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-card border border-border bg-surface p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
            <p className="text-[12.5px] leading-relaxed text-text-2">
              {canSubmit
                ? "Everything's in — submit your practice for verification. You can keep using Phila while we review."
                : `Complete the required fields and documents to submit${missingFields > 0 ? ` (${missingFields} field${missingFields === 1 ? "" : "s"} left)` : ""}.`}
            </p>
          </div>
          <Button onClick={submit} loading={submitting} disabled={!canSubmit} className="shrink-0">
            <ShieldCheck className="size-4" strokeWidth={2} aria-hidden /> Submit for verification
          </Button>
        </div>
      )}
    </div>
  );
}

function DocRow({ doc, readOnly }: { doc: OnboardingDocRow; readOnly: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const tone: Record<OnboardingDocRow["status"], { label: string; cls: string; icon: typeof Check }> = {
    verified: { label: "Verified", cls: "text-accent", icon: BadgeCheck },
    pending: { label: "Awaiting review", cls: "text-info", icon: Clock },
    rejected: { label: "Sent back", cls: "text-warn", icon: TriangleAlert },
    missing: { label: doc.required ? "Required" : "Optional", cls: "text-text-3", icon: FileCheck2 },
  };
  const s = tone[doc.status];
  const StatusIcon = s.icon;
  const done = doc.status === "verified" || doc.status === "pending";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const type = file.type || "application/octet-stream";
      const req = await requestOnboardingUpload({ requirementId: doc.requirementId, name: file.name, contentType: type, bytes: file.size });
      if (!req.ok) return toast({ tone: "error", title: "Couldn't upload", description: req.error });
      const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: file });
      if (!put.ok) return toast({ tone: "error", title: "Upload failed", description: "Please try again." });
      const conf = await confirmOnboardingUpload({ requirementId: doc.requirementId, name: file.name, storageKey: req.storageKey, bytes: file.size });
      if (!conf.ok) return toast({ tone: "error", title: "Upload failed", description: conf.error });
      toast({ tone: "success", title: `${doc.label} uploaded` });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const res = await signOnboardingDocDownload({ requirementId: doc.requirementId });
    if (!res.ok) return toast({ tone: "error", title: "Can't open this", description: res.error });
    window.open(res.url, "_blank", "noopener");
  }

  return (
    <li className={cn("flex items-start gap-3 rounded-control border p-3.5", done ? "border-accent/25 bg-accent-soft/20" : doc.status === "rejected" ? "border-warn/30 bg-warn-soft/20" : "border-border")}>
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-chip", done ? "bg-accent text-accent-ink" : "bg-surface-2 text-text-3")}>
        {done ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : <FileCheck2 className="size-4" strokeWidth={2} aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13.5px] font-medium text-text">{doc.label}</span>
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", s.cls)}>
            <StatusIcon className="size-3" strokeWidth={2} aria-hidden /> {s.label}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-text-2">{doc.fileName ?? doc.description}</p>
        {doc.status === "rejected" && doc.reviewNote && (
          <p className="mt-1 rounded-[6px] bg-warn-soft/50 px-2 py-1 text-[11.5px] text-warn">{doc.reviewNote}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {doc.fileName && (
          <Button variant="ghost" size="sm" onClick={download} aria-label="Download">
            <Download className="size-4" strokeWidth={2} aria-hidden />
          </Button>
        )}
        {!readOnly && (
          <>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={onFile} aria-hidden />
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Upload className="size-4" strokeWidth={2} aria-hidden />}
              {doc.fileName ? "Replace" : "Upload"}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
