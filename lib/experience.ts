import type {
  EligibilityEvidence,
  OptimizationObjective,
  Opportunity,
  ProgramFilterSummary,
  ScenarioOverride,
} from "@/lib/types";

export const OBJECTIVES: Array<{
  id: OptimizationObjective;
  label: string;
  detail: string;
}> = [
  { id: "max_value", label: "Find the most money", detail: "Lead with the largest verified incentive value." },
  { id: "min_upfront", label: "Spend as little upfront as possible", detail: "Prioritize the lowest net cost to act." },
  { id: "all_eligible", label: "Show me everything worth pursuing", detail: "Keep breadth ahead of a single recommendation." },
  { id: "long_term_savings", label: "Maximize long-term savings", detail: "Prioritize estimated annual savings over rebate size." },
];

export function objectiveLabel(objective: OptimizationObjective | null): string {
  return OBJECTIVES.find((item) => item.id === objective)?.label ?? "Show me everything worth pursuing";
}

function netUpfront(opportunity: Opportunity): number {
  return Math.max(0, opportunity.estimatedUpfrontCost - opportunity.estimatedIncentive);
}

export function rankOpportunities(
  opportunities: Opportunity[],
  objective: OptimizationObjective | null,
): Opportunity[] {
  return [...opportunities].sort((a, b) => {
    if (a.status === "not_eligible" && b.status !== "not_eligible") return 1;
    if (b.status === "not_eligible" && a.status !== "not_eligible") return -1;

    if (objective === "min_upfront") {
      return netUpfront(a) - netUpfront(b) || b.estimatedIncentive - a.estimatedIncentive;
    }
    if (objective === "long_term_savings") {
      return b.estimatedAnnualSavings - a.estimatedAnnualSavings || b.estimatedIncentive - a.estimatedIncentive;
    }
    if (objective === "all_eligible") {
      const statusWeight = { ready_to_pursue: 0, needs_answers: 1, not_eligible: 2 } as const;
      return statusWeight[a.status] - statusWeight[b.status] || b.estimatedIncentive - a.estimatedIncentive;
    }
    return (
      b.estimatedIncentive + b.estimatedAnnualSavings -
      (a.estimatedIncentive + a.estimatedAnnualSavings)
    );
  });
}

export function deriveProgramFilterSummary(opportunities: Opportunity[]): ProgramFilterSummary {
  const summary: ProgramFilterSummary = {
    considered: opportunities.length,
    excludedJurisdiction: 0,
    excludedProvider: 0,
    excludedHousehold: 0,
    unresolved: 0,
    matched: 0,
  };

  opportunities.forEach((opportunity) => {
    if (opportunity.status === "needs_answers") {
      summary.unresolved += 1;
      return;
    }
    if (opportunity.status !== "not_eligible") {
      summary.matched += 1;
      return;
    }

    const failed = opportunity.evidence.filter((item) => item.status === "fail");
    if (failed.some((item) => item.criterion.toLowerCase().includes("region"))) {
      summary.excludedJurisdiction += 1;
    } else if (failed.some((item) => item.criterion.toLowerCase().includes("provider"))) {
      summary.excludedProvider += 1;
    } else {
      summary.excludedHousehold += 1;
    }
  });

  return summary;
}

export function scenarioDescription(scenario: ScenarioOverride): string {
  if (scenario.tenure === "renter") return "If this household rents";
  if (scenario.tenure === "owner") return "If this household owns";
  if (scenario.maxUpfrontCost != null) return `With a $${scenario.maxUpfrontCost.toLocaleString("en-CA")} upfront limit`;
  if (scenario.objective) return objectiveLabel(scenario.objective);
  return "Current household";
}

export function applyTenureScenario(
  opportunities: Opportunity[],
  tenure: "owner" | "renter",
): Opportunity[] {
  return opportunities.map((opportunity) => {
    const hasTenureCriterion = opportunity.evidence.some((item) => item.criterion === "Homeowner status");
    if (!hasTenureCriterion) return { ...opportunity, evidence: [...opportunity.evidence] };

    const evidence = opportunity.evidence.map((item) =>
      item.criterion === "Homeowner status"
        ? {
            ...item,
            observedValue: tenure,
            status: (tenure === "owner" ? "pass" : "fail") as EligibilityEvidence["status"],
          }
        : { ...item },
    );
    const hasFail = evidence.some((item) => item.status === "fail");
    const hasUnknown = evidence.some((item) => item.status === "unknown");
    return {
      ...opportunity,
      evidence,
      status: hasFail ? "not_eligible" : hasUnknown ? "needs_answers" : "ready_to_pursue",
      eligibilityConfidence: hasFail ? 0.12 : hasUnknown ? 0.78 : 0.94,
      unresolvedQuestions: opportunity.unresolvedQuestions.filter((question) => question !== "Do you own or rent this property?"),
    };
  });
}
