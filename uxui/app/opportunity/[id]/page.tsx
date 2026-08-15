"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { EligibilityMatrix } from "@/components/EligibilityMatrix";
import { Metric } from "@/components/Metric";
import { INCENTIVE_PROGRAMS } from "@/lib/data/fixtures";
import { SourceBadge } from "@/components/SourceBadge";
import { TactileButton } from "@/components/motion/TactileButton";

export default function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { opportunities, household, hydrated } = useGreenlight();

  useEffect(() => {
    if (hydrated && !household) router.replace("/");
  }, [hydrated, household, router]);

  const opportunity = opportunities.find((o) => o.id === id);
  if (!household || !opportunity) return null;

  const program = INCENTIVE_PROGRAMS.find((p) => p.id === opportunity.incentiveId)!;

  return (
    <div className="flex-1 px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-[13px] text-ink-muted mb-1">{program.provider}</p>
        <h1 className="text-2xl font-medium mb-1">{opportunity.title}</h1>
        <p className="text-[14px] text-ink-soft mb-6 max-w-xl">{program.description}</p>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <div className="flex flex-col gap-6 order-2 lg:order-1">
            <div>
              <p className="text-[13px] font-medium mb-2">Eligibility evidence</p>
              <EligibilityMatrix evidence={opportunity.evidence} />
            </div>
            <div>
              <p className="text-[13px] font-medium mb-2">Economics</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Potential incentive" value={`$${opportunity.estimatedIncentive.toLocaleString("en-CA")}`} tone="success" />
                <Metric label="Est. upfront cost" value={`$${opportunity.estimatedUpfrontCost.toLocaleString("en-CA")}`} />
                <Metric
                  label={`Est. annual savings · ${opportunity.savingsBasis === "usage_derived" ? "based on your usage" : "estimated"}`}
                  value={`$${opportunity.estimatedAnnualSavings.toLocaleString("en-CA")}`}
                  tone="success"
                />
                <Metric label="Payback" value={opportunity.estimatedPaybackYears ? `${opportunity.estimatedPaybackYears} yrs` : "—"} />
              </div>
            </div>
            <SourceBadge url={program.officialUrl} label={program.actionRoute.sourceTitle ?? "Official program page"} verifiedAt={program.lastVerifiedAt} />
          </div>

          <div className="order-1 lg:order-2 flex flex-col gap-3">
            <div className="rounded-lg border border-line bg-card p-4">
              <p className="text-[13px] text-ink-muted mb-1">Next step</p>
              <p className="text-[14px] font-medium mb-3">
                {opportunity.status === "needs_answers" ? "Needs 1 answer" : "Program application"}
              </p>
              <TactileButton
                onClick={() => router.push(`/agent/${opportunity.id}`)}
                className="w-full rounded-lg bg-ink text-white text-[14px] font-medium py-2.5 hover:bg-ink/90 transition-colors"
              >
                Get it for me
              </TactileButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
