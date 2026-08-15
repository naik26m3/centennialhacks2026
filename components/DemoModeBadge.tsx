export function DemoModeBadge({ live = false }: { live?: boolean }) {
  if (live) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-brand border border-brand/40 bg-brand-soft rounded-full px-2.5 py-1">
        Live · Gemini-analyzed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-muted border border-line rounded-full px-2.5 py-1">
      Demo mode · sample household
    </span>
  );
}
