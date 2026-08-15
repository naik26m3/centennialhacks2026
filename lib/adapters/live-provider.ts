import { INCENTIVE_PROGRAMS } from "@/lib/data/fixtures";
import { EligibilityAssessmentResult } from "@/lib/ai/schemas";
import { assessEligibilityBatchWithGemini } from "@/lib/ai/gemini";
import { aggregateElectricityUsage, aggregateNaturalGasUsage, estimateOpportunityEconomicsFromUsage } from "@/lib/calculations/payback";
import { evidenceFor } from "@/lib/adapters/demo-provider";
import { HouseholdProfile, EligibilityEvidence, IncentiveProgram, Opportunity, UtilityBillExtraction } from "@/lib/types";

// Only what the bills can honestly tell you — no fabricated dwelling type.
// Tenure stays "unknown" and is resolved the same way as the demo path: the
// user answers Own/Rent in the agent flow (see
// lib/context/greenlight-context.tsx#resolveTenureAnswer).
//
// primaryHeating comes from Gemini's own primaryHeatingHint per bill (see
// lib/ai/gemini.ts) — a bill that says "no natural gas service" contains the
// substring "natural gas", so naive keyword matching over detectedHeatingClues
// reads it backwards. Interpreting that kind of negation is exactly what the
// model should do; a regex shouldn't try to out-guess it.
//
// When a household uploads both an electricity and a gas bill, "electric" is
// often just the electric bill's default in the absence of any gas-specific
// evidence, not positive proof there's no separate gas-heated furnace — every
// home has an electric bill regardless of heating fuel. A gas/oil/propane
// hint from another bill is much stronger, more specific evidence, so it
// wins even over an equally- or more-confident "electric" hint. Only once
// every uploaded bill is that generic does confidence/recency decide.
function resolvePrimaryHeating(bills: UtilityBillExtraction[]): UtilityBillExtraction["primaryHeatingHint"] {
  const specific = bills.filter((b) => b.primaryHeatingHint !== "electric" && b.primaryHeatingHint !== "unknown");
  const candidates = specific.length > 0 ? specific : bills;
  const winner = candidates
    .slice()
    .sort((a, b) => b.confidence - a.confidence || (b.billingPeriod.end ?? "").localeCompare(a.billingPeriod.end ?? ""))[0];
  return winner.primaryHeatingHint;
}

export function buildHouseholdProfileFromBills(bills: UtilityBillExtraction[]): HouseholdProfile {
  const mostRecent = bills
    .slice()
    .sort((a, b) => (b.billingPeriod.end ?? "").localeCompare(a.billingPeriod.end ?? ""))[0];

  const gas = aggregateNaturalGasUsage(bills);
  const electricity = aggregateElectricityUsage(bills);
  const avgConfidence = bills.reduce((sum, b) => sum + b.confidence, 0) / bills.length;

  return {
    id: `household-${Date.now()}`,
    country: mostRecent.serviceAddress.country ?? "unknown",
    provinceState: mostRecent.serviceAddress.provinceState ?? "unknown",
    city: mostRecent.serviceAddress.city,
    dwellingType: "unknown",
    tenure: "unknown",
    primaryHeating: resolvePrimaryHeating(bills),
    utilityProvider: mostRecent.provider,
    annualElectricityKwh: electricity ? Math.round(electricity.annualUsage) : null,
    annualNaturalGasM3: gas ? Math.round(gas.annualUsage) : null,
    monthsOfDataUsed: { electricity: electricity?.monthsOfData ?? 0, naturalGas: gas?.monthsOfData ?? 0 },
    existingEquipment: { smartThermostat: false, heatPump: false },
    profileConfidence: avgConfidence,
  };
}

// Region and homeowner status are objective, structured facts — checked
// deterministically here, same as the demo path, never left to model
// judgment. Gemini's assessment fills in the remaining, less-structured
// criteria (heating-type fit, assessment prerequisites, etc.) as evidence
// rows, and supplies the plain-language reasoningSummary.
function buildLiveEvidence(
  program: IncentiveProgram,
  household: HouseholdProfile,
  assessment: EligibilityAssessmentResult
): EligibilityEvidence[] {
  const evidence = evidenceFor(program, household).filter(
    (e) => e.criterion === "Region" || e.criterion === "Homeowner status"
  );

  assessment.satisfiedCriteria.forEach((criterion) =>
    evidence.push({ criterion, observedValue: "Confirmed", expectedValue: "Program requirement", status: "pass", source: "Gemini eligibility assessment" })
  );
  assessment.disqualifiers.forEach((criterion) =>
    evidence.push({ criterion, observedValue: "Does not meet requirement", expectedValue: "Program requirement", status: "fail", source: "Gemini eligibility assessment" })
  );
  assessment.missingInformation.forEach((criterion) =>
    evidence.push({ criterion, observedValue: "Not yet known", expectedValue: "Program requirement", status: "unknown", source: "Gemini eligibility assessment" })
  );

  return evidence;
}

function fallbackAssessment(reason: string): EligibilityAssessmentResult {
  return {
    status: "insufficient_information",
    confidence: 0.5,
    satisfiedCriteria: [],
    missingInformation: [reason],
    disqualifiers: [],
    explanation: reason,
  };
}

export async function matchOpportunitiesLive(bills: UtilityBillExtraction[], household: HouseholdProfile): Promise<Opportunity[]> {
  let assessments: Record<string, EligibilityAssessmentResult>;
  try {
    assessments = await assessEligibilityBatchWithGemini(INCENTIVE_PROGRAMS, household, bills);
  } catch (err) {
    console.error("Batched live eligibility assessment failed:", err);
    assessments = {};
  }

  return INCENTIVE_PROGRAMS.map((program) => {
    const assessment =
      assessments[program.id] ??
      fallbackAssessment("Live eligibility reasoning was unavailable for this program — treating it as unconfirmed.");

    const evidence = buildLiveEvidence(program, household, assessment);
    const hasFail = evidence.some((e) => e.status === "fail");
    const hasUnknown = evidence.some((e) => e.status === "unknown");
    const status: Opportunity["status"] = hasFail ? "not_eligible" : hasUnknown ? "needs_answers" : "ready_to_pursue";
    const tenureUnresolved = evidence.some((e) => e.criterion === "Homeowner status" && e.status === "unknown");

    return {
      id: `opp-${program.id}`,
      incentiveId: program.id,
      title: program.name,
      category: program.category,
      ...estimateOpportunityEconomicsFromUsage(program, household, bills),
      eligibilityConfidence: hasFail ? 0.1 : assessment.confidence,
      status,
      reasoningSummary: assessment.explanation,
      evidence,
      unresolvedQuestions: tenureUnresolved ? ["Do you own or rent this property?"] : [],
    };
  });
}
