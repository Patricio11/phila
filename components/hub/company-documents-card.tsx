"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, FolderOpen, Link2, Mail, Upload } from "lucide-react";
import type { Document } from "@/lib/domain/types";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { requestUpload, confirmUpload, addLinkDocument, signDownload } from "@/app/hub/documents/actions";
import { sizeLabel } from "@/lib/documents/quota";
import { ShareEmailDialog } from "@/components/documents/share-email-dialog";

const DAY = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/**
 * Batch 3f - everything asked of one employer, kept together. This card IS the
 * company's folder under Documents → Companies: upload here, add a link here,
 * and it shows there too - one folder, two doors.
 */
export function CompanyDocumentsCard({ companyName, folderId, docs, storageEnabled, contactEmail = null }: {
  companyName: string;
  folderId: string;
  docs: Document[];
  storageEnabled: boolean;
  /** Batch 3p - prefills "Email to company"; the folder travels as one link. */
  contactEmail?: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const type = file.type || "application/octet-stream";
      const req = await requestUpload({ name: file.name, contentType: type, bytes: file.size, folderId });
      if (!req.ok) return toast({ tone: "error", title: "Couldn't upload", description: req.error });
      const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: file });
      if (!put.ok) return toast({ tone: "error", title: "Upload failed", description: "Please try again." });
      const done = await confirmUpload({ documentId: req.documentId, bytes: file.size });
      if (!done.ok) return toast({ tone: "error", title: "Couldn't finish the upload", description: done.error });
      toast({ tone: "success", title: "Uploaded", description: `Filed under Documents → Companies → ${companyName}.` });
      router.refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addLink = async () => {
    if (addingLink) return;
    setAddingLink(true);
    try {
      const res = await addLinkDocument({ name: linkName.trim(), url: linkUrl.trim(), folderId });
      if (!res.ok) return toast({ tone: "error", title: "Couldn't add the link", description: res.error });
      toast({ tone: "success", title: "Link added", description: `Filed under Documents → Companies → ${companyName}.` });
      setLinkOpen(false); setLinkName(""); setLinkUrl("");
      router.refresh();
    } finally {
      setAddingLink(false);
    }
  };

  const open = async (d: Document) => {
    if (d.externalUrl) { window.open(d.externalUrl, "_blank", "noopener,noreferrer"); return; }
    const res = await signDownload({ documentId: d.id });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    window.open(res.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHead
        title="Documents"
        count={docs.length}
        action={
          <Link href={`/hub/documents?folder=${folderId}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
            <FolderOpen className="size-3.5" strokeWidth={2} aria-hidden /> Open in Documents
          </Link>
        }
      />
      <div className="px-[17px] pb-[17px]">
        <p className="text-[11.5px] leading-relaxed text-text-3">
          Contracts, SLAs, and anything asked of {companyName} - kept in their folder under Documents → Companies.
        </p>

        {docs.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-3">
                  {d.externalUrl ? <Link2 className="size-4 text-accent" strokeWidth={1.9} aria-hidden /> : <FileText className="size-4" strokeWidth={1.9} aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-text">{d.name}</div>
                  <div className="text-[11px] text-text-3">{d.externalUrl ? "link" : sizeLabel(d.bytes)} · {DAY(d.createdAt)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void open(d)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text"
                  aria-label={`Open ${d.name}`}
                >
                  <ExternalLink className="size-4" strokeWidth={1.9} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={uploading}
            onClick={() =>
              storageEnabled
                ? fileRef.current?.click()
                : toast({ tone: "default", title: "Switch on Phila Storage", description: "An admin enables it in Admin → Integrations before uploads work." })
            }
          >
            <Upload className="size-3.5" strokeWidth={2} aria-hidden /> Upload
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLinkOpen(true)}>
            <Link2 className="size-3.5" strokeWidth={2} aria-hidden /> Add link
          </Button>
          {docs.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setEmailOpen(true)}>
              <Mail className="size-3.5" strokeWidth={2} aria-hidden /> Email to company
            </Button>
          )}
        </div>
        {emailOpen && (
          <ShareEmailDialog
            open={emailOpen}
            onClose={() => setEmailOpen(false)}
            documentIds={[]}
            folderId={folderId}
            what={`the "${companyName}" folder`}
            defaultEmail={contactEmail}
          />
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          aria-hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
      </div>

      <Dialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Add a link"
        description={`A document that lives elsewhere - filed in ${companyName}'s folder.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => void addLink()} loading={addingLink} disabled={addingLink || linkName.trim().length < 2 || !/^https?:\/\//i.test(linkUrl.trim())}>Add link</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input aria-label="Link name" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="e.g. Signed SLA 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Link</Label>
            <Input aria-label="Link URL" inputMode="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
