export function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const label = pct >= 85 ? "High" : pct >= 55 ? "Medium" : "Low";
  const color = pct >= 85 ? "bg-success" : pct >= 55 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-line overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] text-ink-soft">{label} · {pct}%</span>
    </div>
  );
}
