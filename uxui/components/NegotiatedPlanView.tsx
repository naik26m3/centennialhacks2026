import { NegotiatedPlan } from "@/lib/types";
import { Metric } from "@/components/Metric";

export function NegotiatedPlanView({ plan }: { plan: NegotiatedPlan }) {
  if (plan.items.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-card p-4 text-[13px] text-ink-soft">
        No combination of tracked programs fits that constraint yet. Try raising the upfront budget.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line bg-card divide-y divide-line">
        {plan.items.map((item) => (
          <div key={item.opportunityId} className="p-4">
            <p className="text-[14px] font-medium">{item.title}</p>
            <div className="flex gap-4 mt-1 text-[13px] text-ink-soft tabular-nums">
              <span>Net upfront ${item.upfrontCost.toLocaleString("en-CA")}</span>
              <span>Incentive ${item.incentive.toLocaleString("en-CA")}</span>
              <span>Savings ${item.annualSavings.toLocaleString("en-CA")}/yr</span>
            </div>
          </div>
        ))}
      </div>

      {plan.constraintSatisfied !== null && (
        <p className={`text-[14px] font-medium ${plan.constraintSatisfied ? "text-success" : "text-warning"}`}>
          {plan.constraintSatisfied ? "Constraint satisfied." : "This gets close, but doesn't fully satisfy the constraint yet."}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Budget ceiling" value={plan.budgetCeiling != null ? `$${plan.budgetCeiling.toLocaleString("en-CA")}` : "None set"} />
        <Metric label="Estimated upfront cost" value={`$${plan.estimatedUpfrontCost.toLocaleString("en-CA")}`} />
        <Metric label="Potential first-year value" value={`$${plan.potentialFirstYearValue.toLocaleString("en-CA")}`} tone="success" />
        <Metric label="Est. CO2e reduction" value={`${plan.estimatedCo2ReductionKg.toLocaleString("en-CA")} kg/yr`} />
      </div>
    </div>
  );
}
