import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { EligibilityEvidence } from "@/lib/types";

const icons = {
  pass: <CheckCircle2 size={16} className="text-success" aria-hidden="true" />,
  fail: <XCircle size={16} className="text-danger" aria-hidden="true" />,
  unknown: <HelpCircle size={16} className="text-warning" aria-hidden="true" />,
  manual_review: <HelpCircle size={16} className="text-warning" aria-hidden="true" />,
};

export function EligibilityMatrix({ evidence }: { evidence: EligibilityEvidence[] }) {
  return (
    <div className="rounded-lg border border-line bg-card divide-y divide-line">
      {evidence.map((e) => (
        <div key={e.criterion} className="flex items-start gap-3 p-3.5">
          {icons[e.status]}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{e.criterion}</p>
            <p className="text-[12px] text-ink-muted mt-0.5">
              {e.observedValue || "not confirmed"} · expected {e.expectedValue}
            </p>
            <p className="text-[11px] text-ink-muted mt-0.5">{e.source}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
