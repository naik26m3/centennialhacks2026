import { ApplicationField } from "@/lib/types";

export function ApplicationPacket({ fields }: { fields: ApplicationField[] }) {
  const complete = fields.filter((f) => f.source !== "missing").length;
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-medium">Application ready for review</p>
        <span className="text-[13px] text-ink-muted tabular-nums">{complete} / {fields.length} fields complete</span>
      </div>
      <dl className="flex flex-col gap-2">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between text-[13px]">
            <dt className="text-ink-muted">{f.label}</dt>
            <dd className={f.source === "missing" ? "text-warning" : "text-ink"}>
              {f.value || "Needs your input"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
