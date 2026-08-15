import { INCENTIVE_PROGRAMS } from "@/lib/data/fixtures";
import { EligibilityAssessmentResult } from "@/lib/ai/schemas";
import { assessEligibilityWithGemini } from "@/lib/ai/gemini";
import { estimateOpportunityEconomics } from "@/lib/calculations/payback";
import { evidenceFor } from "@/lib/adapters/demo-provider";
import { EligibilityEvidence, HeatingType, HouseholdProfile, IncentiveProgram, Opportunity, UtilityBillExtraction } from "@/lib/types";

// Only what a bill can honestly tell you — no fabricated dwelling type or
// annual usage the bill doesn't actually show. Tenure stays "unknown" and is
// resolved the same way as the demo path: the user answers Own/Rent in the
// agent flow (see lib/context/greenlight-context.tsx#resolveTenureAnswer).
function inferPrimaryHeating(bill: UtilityBillExtraction): HeatingType {
  const clues = bill.detectedHeatingClues.join(" ").toLowerCase();
  if (clues.includes("heat pump")) return "heat_pump";
  if (clues.includes("propane")) return "propane";
  if (clues.includes("oil")) return "oil";
  if (bill.naturalGas && !bill.electricity) return "natural_gas";
  if (clues.includes("natural gas") || clues.includes("gas")) return "natural_gas";
  if (bill.electricity && !bill.naturalGas) return "electric";
  return "unknown";
}

export function buildHouseholdProfileFromBill(bill: UtilityBillExtraction): HouseholdProfile {
  return {
    id: `household-${Date.now()}`,
    country: bill.serviceAddress.country ?? "unknown",
    provinceState: bill.serviceAddress.provinceState ?? "unknown",
    city: bill.serviceAddress.city,
    dwellingType: "unknown",
    tenure: "unknown",
    primaryHeating: inferPrimaryHeating(bill),
    utilityProvider: bill.provider,
    annualElectricityKwh: null,
    existingEquipment: { smartThermostat: false, heatPump: false },
    profileConfidence: bill.confidence,
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

export async function matchOpportunitiesLive(bill: UtilityBillExtraction, household: HouseholdProfile): Promise<Opportunity[]> {
  return Promise.all(
    INCENTIVE_PROGRAMS.map(async (program) => {
      let assessment: EligibilityAssessmentResult;
      try {
        assessment = await assessEligibilityWithGemini(program, household, bill);
      } catch (err) {
        console.error(`Live eligibility assessment failed for ${program.id}:`, err);
        assessment = fallbackAssessment("Live eligibility reasoning was unavailable for this program — treating it as unconfirmed.");
      }

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
        ...estimateOpportunityEconomics(program),
        eligibilityConfidence: hasFail ? 0.1 : assessment.confidence,
        status,
        reasoningSummary: assessment.explanation,
        evidence,
        unresolvedQuestions: tenureUnresolved ? ["Do you own or rent this property?"] : [],
      };
    })
  );
}
