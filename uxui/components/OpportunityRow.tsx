import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Opportunity } from "@/lib/types";
import { ConfidenceIndicator } from "@/components/ConfidenceIndicator";

const statusLabel: Record<Opportunity["status"], string> = {
  ready_to_pursue: "Ready to pursue",
  needs_answers: "Needs 1 answer",
  not_eligible: "Not currently eligible",
};

const statusTone: Record<Opportunity["status"], string> = {
  ready_to_pursue: "text-success bg-success-soft",
  needs_answers: "text-warning bg-warning-soft",
  not_eligible: "text-ink-muted bg-canvas",
};

export function OpportunityRow({ opportunity }: { opportunity: Opportunity }) {
  return (
    <Link
      href={`/opportunity/${opportunity.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-line bg-card p-4 hover:border-line-strong transition-colors"
    >
      <div className="min-w-0">
        <p className="text-[15px] font-medium truncate">{opportunity.title}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[13px] text-ink-soft tabular-nums">
            Up to ${opportunity.estimatedIncentive.toLocaleString("en-CA")}
          </span>
          <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${statusTone[opportunity.status]}`}>
            {statusLabel[opportunity.status]}
          </span>
        </div>
        <div className="mt-2">
          <ConfidenceIndicator confidence={opportunity.eligibilityConfidence} />
        </div>
      </div>
      <ArrowRight size={18} className="text-ink-muted shrink-0" aria-hidden="true" />
    </Link>
  );
}
