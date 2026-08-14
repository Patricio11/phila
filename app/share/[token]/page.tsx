import Link from "next/link";
import { Clock, Download, FileText, FolderDown, Link2, ExternalLink } from "lucide-react";
import { PhilaMark } from "@/components/brand/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Files shared with you", robots: { index: false, follow: false } };

/**
 * Batch 3p - the emailed download link's landing page. Public by token, calm
 * and branded: the practice's name, the files, per-file Download buttons, and
 * "Download all (.zip)" when there's more than one. Expiry is honest.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (process.env.DATA_PROVIDER !== "db") return <Notice title="This link isn't available" body="File sharing runs on the live system only." />;

  const { getShareForTokenDb } = await import("@/db/queries/share-links");
  const view = await getShareForTokenDb(token);

  if (!view || view.revoked) return <Notice title="This link isn't valid" body="This share link has expired or was withdrawn. Please ask the practice to send a fresh one." />;
  if (view.expired) return <Notice title="This link has expired" body={`${view.orgName} set this link to expire, and that time has passed. Please ask them to share the files again.`} />;
  if (view.docs.length === 0) return <Notice title="Nothing here any more" body={`The files ${view.orgName} shared are no longer available. Please ask them to share again.`} />;

  const files = view.docs.filter((d) => !d.externalUrl);
  const expires = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric" }).format(view.expiresAt);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex items-center justify-center gap-2 text-text-2">
          <PhilaMark size={28} />
          <span className="text-[15px] font-[680] tracking-[-0.01em] text-text">Phila</span>
        </div>

        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-e2">
          <div className="border-b border-border px-6 py-5">
            <div className="text-[12px] font-medium uppercase tracking-wide text-text-3">{view.orgName}</div>
            <h1 className="mt-1 text-[19px] font-[700] tracking-[-0.02em] text-text">
              {view.folderName ? `The "${view.folderName}" folder` : `${view.docs.length} file${view.docs.length === 1 ? "" : "s"} shared with you`}
            </h1>
            {view.note && <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">&ldquo;{view.note}&rdquo;</p>}
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-text-3">
              <Clock className="size-3.5" strokeWidth={2} aria-hidden /> Link works until {expires}
            </p>
          </div>

          <ul className="divide-y divide-border">
            {view.docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-6 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-2 text-text-3">
                  {d.externalUrl ? <Link2 className="size-4" strokeWidth={2} aria-hidden /> : <FileText className="size-4" strokeWidth={2} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-text">{d.name}</span>
                  <span className="block text-[11.5px] text-text-3">{d.externalUrl ? "External link" : d.sizeLabel}</span>
                </span>
                {d.externalUrl ? (
                  <a href={d.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
                    <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden /> Open
                  </a>
                ) : (
                  <a href={`/share/${token}/f/${d.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
                    <Download className="size-3.5" strokeWidth={2} aria-hidden /> Download
                  </a>
                )}
              </li>
            ))}
          </ul>

          {files.length > 1 && (
            <div className="border-t border-border px-6 py-4">
              <a href={`/share/${token}/zip`} className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink transition-[filter] hover:brightness-95">
                <FolderDown className="size-4" strokeWidth={2} aria-hidden />
                Download all as .zip ({files.length} files)
              </a>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11.5px] text-text-3">
          Shared privately with you by {view.orgName} via <Link href="/" className="underline">Phila</Link>. Please don&apos;t forward this link.
        </p>
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2 text-text-2">
          <PhilaMark size={28} />
          <span className="text-[15px] font-[680] tracking-[-0.01em] text-text">Phila</span>
        </div>
        <div className="space-y-2 rounded-card border border-border bg-surface px-6 py-12 text-center shadow-e2">
          <Link2 className="mx-auto size-11 text-text-3" strokeWidth={1.7} aria-hidden />
          <div className="text-[16px] font-[680] text-text">{title}</div>
          <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-text-2">{body}</p>
        </div>
      </div>
    </main>
  );
}
