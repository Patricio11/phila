"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CREDENTIAL_BODIES, type CredentialBody } from "@/lib/domain/enums";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { saveMemberProfile } from "@/app/hub/team/actions";

interface Qualification { qualification: string; institution: string; year: number }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border pb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">{children}</div>;
}

export interface MemberProfileInitial {
  name: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  bio: string;
  languages: string[];
  qualifications: Qualification[];
  specialties: string[];
  credential: { body: CredentialBody; registrationNo: string } | null;
}

/**
 * Batch 2i - the org edits a member's WHOLE profile: name, contact, bio,
 * education, specialties, and (counsellors) the credential. Changing the
 * credential body / registration number resets verification to pending -
 * the dialog says so before it happens, no surprises.
 */
export function EditMemberProfileButton({ userId, initial }: { userId: string; initial: MemberProfileInitial }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [dob, setDob] = useState(initial.dateOfBirth);
  const [address, setAddress] = useState(initial.address);
  const [bio, setBio] = useState(initial.bio);
  const [languagesText, setLanguagesText] = useState(initial.languages.join(", "));
  const [specialtiesText, setSpecialtiesText] = useState(initial.specialties.join(", "));
  const [quals, setQuals] = useState<Qualification[]>(initial.qualifications);
  const [credBody, setCredBody] = useState<CredentialBody>(initial.credential?.body ?? "HPCSA");
  const [credReg, setCredReg] = useState(initial.credential?.registrationNo ?? "");

  const credChanged = initial.credential
    ? credBody !== initial.credential.body || credReg.trim() !== initial.credential.registrationNo
    : false;

  const patchQual = (i: number, next: Partial<Qualification>) =>
    setQuals((list) => list.map((q, k) => (k === i ? { ...q, ...next } : q)));

  const split = (text: string) => [...new Set(text.split(",").map((s) => s.trim()).filter(Boolean))];

  const save = () => start(async () => {
    const res = await saveMemberProfile({
      userId,
      name: name.trim(),
      phone: phone.trim(),
      dateOfBirth: dob,
      address: address.trim(),
      bio: bio.trim(),
      languages: split(languagesText),
      specialties: split(specialtiesText),
      qualifications: quals
        .filter((q) => q.qualification.trim().length >= 2)
        .map((q) => ({ qualification: q.qualification.trim(), institution: q.institution.trim(), year: q.year })),
      credential: initial.credential ? { body: credBody, registrationNo: credReg.trim() } : null,
    });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({
      tone: "success",
      title: "Profile updated",
      description: res.credentialReset
        ? "The credential changed, so its verification is back to pending - re-verify under Verification."
        : "Everything saved.",
    });
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" strokeWidth={2} aria-hidden /> Edit profile
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit ${initial.name.split(" ")[0]}'s profile`}
        description="Everything here is the org's to keep accurate - contact, education, and credentials."
        className="sm:h-[min(92dvh,1080px)] sm:max-w-3xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={save} loading={pending} disabled={name.trim().length < 2}>Save profile</Button>
          </div>
        }
      >
        <div className="grid gap-x-8 gap-y-5 py-1 sm:grid-cols-2">
          {/* Left page half - who they are */}
          <div className="space-y-5">
            <SectionTitle>Personal & contact</SectionTitle>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 ..." />
              </div>
              <div className="space-y-1.5">
                <Label>Date of birth</Label>
                <DatePicker value={dob} onChange={setDob} max={new Date().toLocaleDateString("en-CA")} ariaLabel="Date of birth" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, suburb, city, postal code" />
            </div>

            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[120px]" placeholder="A short professional bio - focus areas, way of working…" />
            </div>

            <div className="space-y-1.5">
              <Label>Languages (display)</Label>
              <Input value={languagesText} onChange={(e) => setLanguagesText(e.target.value)} placeholder="English, Afrikaans, Hindi" />
              <p className="text-[11px] text-text-3">Comma-separated. Matching uses the Languages card on the profile.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Specialties</Label>
              <Input value={specialtiesText} onChange={(e) => setSpecialtiesText(e.target.value)} placeholder="Trauma, CBT, Couples" />
              <p className="text-[11px] text-text-3">Comma-separated.</p>
            </div>
          </div>

          {/* Right page half - what qualifies them */}
          <div className="space-y-5">
            <SectionTitle>Education & qualifications</SectionTitle>
            <div className="space-y-3">
              {quals.length === 0 && <p className="text-[12.5px] text-text-3">Nothing on file yet - add their first qualification.</p>}
              {quals.map((q, i) => (
                <div key={i} className="space-y-2 rounded-control border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input value={q.qualification} onChange={(e) => patchQual(i, { qualification: e.target.value })} placeholder="Qualification - e.g. BPsych Honours" />
                    <button type="button" onClick={() => setQuals((l) => l.filter((_, k) => k !== i))} aria-label="Remove qualification" className="shrink-0 rounded p-1.5 text-text-3 transition-colors hover:bg-surface-hover hover:text-danger">
                      <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input value={q.institution} onChange={(e) => patchQual(i, { institution: e.target.value })} placeholder="Institution - e.g. Wits" className="flex-1" />
                    <Input inputMode="numeric" value={String(q.year || "")} onChange={(e) => patchQual(i, { year: Number(e.target.value.replace(/[^\d]/g, "").slice(0, 4)) || 0 })} placeholder="Year" className="w-24" />
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setQuals((l) => [...l, { qualification: "", institution: "", year: new Date().getFullYear() }])} className="w-full border border-dashed border-border">
                <Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> Add qualification
              </Button>
            </div>

            {initial.credential && (
              <>
                <SectionTitle>Professional credential</SectionTitle>
                <div className="space-y-3 rounded-control border border-border bg-surface-2/40 p-4">
                  <div className="space-y-1.5">
                    <Label>Registration body</Label>
                    <Select value={credBody} onChange={(v) => setCredBody(v as CredentialBody)} options={CREDENTIAL_BODIES.map((b) => ({ value: b, label: b }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Registration number</Label>
                    <Input value={credReg} onChange={(e) => setCredReg(e.target.value)} placeholder="e.g. PS 0098765" />
                  </div>
                  {credChanged ? (
                    <p className="text-[11.5px] leading-relaxed text-warn">Changing the credential resets its verification to pending - you&apos;ll re-verify it under Verification.</p>
                  ) : (
                    <p className="text-[11.5px] leading-relaxed text-text-3">The verified badge stays as long as the credential is unchanged.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
