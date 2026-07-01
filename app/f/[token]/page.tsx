import { CheckCircle2, Link2, Sprout } from "lucide-react";
import { getDataProvider } from "@/lib/data-provider";
import { FormFillView } from "@/components/forms/form-fill-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "A form for you", robots: { index: false, follow: false } };

export default async function FormFillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const provider = await getDataProvider();
  const view = await provider.getFormByToken(token);

  if (!view) return <Notice icon={Link2} title="This link isn't valid" body="This form link has expired or was mistyped. If you were expecting a form, please ask the practice to resend it." />;
  if (view.status === "completed") return <Notice icon={CheckCircle2} title="Already submitted" body={`Thank you  ${view.orgName} already has your answers. There's nothing else to do.`} tone="accent" />;

  return <FormFillView token={token} orgName={view.orgName} snapshot={view.snapshot} />;
}

function Notice({ icon: Icon, title, body, tone }: { icon: typeof Link2; title: string; body: string; tone?: "accent" }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2 text-text-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-white"><Sprout className="size-4" strokeWidth={2} aria-hidden /></span>
          <span className="text-[15px] font-[680] tracking-[-0.01em] text-text">Phila</span>
        </div>
        <div className="space-y-2 rounded-card border border-border bg-surface px-6 py-12 text-center shadow-e2">
          <Icon className={tone === "accent" ? "mx-auto size-11 text-accent" : "mx-auto size-11 text-text-3"} strokeWidth={1.7} aria-hidden />
          <div className="text-[16px] font-[680] text-text">{title}</div>
          <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-text-2">{body}</p>
        </div>
      </div>
    </main>
  );
}
