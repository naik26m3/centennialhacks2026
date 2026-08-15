import { NegotiatedPlan, NegotiatedPlanItem, Opportunity, UserGoal } from "@/lib/types";

// Deterministic greedy optimizer: ranks opportunities by value-per-dollar-of-upfront-
// cost and adds them until the budget ceiling would be exceeded. Intentionally simple
// and inspectable — this is the "code calculates" half of the brief's core rule.
export function buildNegotiatedPlan(
  opportunities: Opportunity[],
  goal: UserGoal | null
): NegotiatedPlan {
  const eligible = opportunities.filter((o) => o.status !== "not_eligible");
  const ranked = [...eligible].sort((a, b) => {
    const scoreA = (a.estimatedIncentive + a.estimatedAnnualSavings) / Math.max(1, a.estimatedUpfrontCost);
    const scoreB = (b.estimatedIncentive + b.estimatedAnnualSavings) / Math.max(1, b.estimatedUpfrontCost);
    return scoreB - scoreA;
  });

  const budgetCeiling = goal?.maxUpfrontCost ?? null;
  const items: NegotiatedPlanItem[] = [];
  let upfront = 0;

  for (const o of ranked) {
    const netCost = Math.max(0, o.estimatedUpfrontCost - o.estimatedIncentive);
    if (budgetCeiling !== null && upfront + netCost > budgetCeiling) continue;
    items.push({
      opportunityId: o.id,
      title: o.title,
      upfrontCost: netCost,
      incentive: o.estimatedIncentive,
      annualSavings: o.estimatedAnnualSavings,
    });
    upfront += netCost;
  }

  const estimatedAnnualSavings = items.reduce((sum, i) => sum + i.annualSavings, 0);
  const potentialFirstYearValue = items.reduce((sum, i) => sum + i.incentive + i.annualSavings, 0);
  const estimatedCo2ReductionKg = items.length * 250; // directional, matches category table order of magnitude

  const constraintSatisfied =
    goal?.minimumAnnualSavings != null ? estimatedAnnualSavings >= goal.minimumAnnualSavings : null;

  return {
    items,
    budgetCeiling,
    estimatedUpfrontCost: Math.round(upfront * 100) / 100,
    potentialFirstYearValue: Math.round(potentialFirstYearValue * 100) / 100,
    estimatedAnnualSavings: Math.round(estimatedAnnualSavings * 100) / 100,
    estimatedCo2ReductionKg,
    constraintSatisfied,
  };
}

export function parseGoalPrompt(raw: string): UserGoal {
  // Demo-mode constraint extraction: simple deterministic regex parsing, standing in
  // for the Gemini call described in the brief (section 25). Swap for a real Gemini
  // structured-output call in lib/ai/gemini.ts when a live key is available.
  const upfrontMatch = raw.match(/(?:less than|under|max(?:imum)?|no more than)\s*\$?(\d[\d,]*)/i);
  const savingsMatch = raw.match(/save\s*(?:me\s*)?\$?(\d[\d,]*)/i);

  return {
    rawPrompt: raw,
    objective: "maximize_annual_savings",
    maxUpfrontCost: upfrontMatch ? Number(upfrontMatch[1].replace(/,/g, "")) : null,
    minimumAnnualSavings: savingsMatch ? Number(savingsMatch[1].replace(/,/g, "")) : null,
    jurisdiction: "ON",
  };
}
