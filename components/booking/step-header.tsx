export function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-[19px] font-[680] tracking-[-0.02em] text-text">{title}</h1>
      {subtitle ? <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">{subtitle}</p> : null}
    </div>
  );
}
