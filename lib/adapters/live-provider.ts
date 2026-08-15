import { evidenceFor } from "@/lib/adapters/demo-provider";
import { aggregateElectricityUsage, aggregateNaturalGasUsage, estimateOpportunityEconomicsFromUsage } from "@/lib/calculations/payback";
import { INCENTIVE_PROGRAMS } from "@/lib/data/fixtures";
import type { EligibilityEvidence, HouseholdProfile, IncentiveProgram, Opportunity, UtilityBillExtraction } from "@/lib/types";

function resolvePrimaryHeating(bills: UtilityBillExtraction[]): UtilityBillExtraction["primaryHeatingHint"] {
  const specific = bills.filter((bill) => bill.primaryHeatingHint !== "electric" && bill.primaryHeatingHint !== "unknown");
  const candidates = specific.length > 0 ? specific : bills;
  return candidates
    .slice()
    .sort((a, b) => b.confidence - a.confidence || (b.billingPeriod.end ?? "").localeCompare(a.billingPeriod.end ?? ""))[0]
    .primaryHeatingHint;
}

export function buildHouseholdProfileFromBills(bills: UtilityBillExtraction[]): HouseholdProfile {
  const mostRecent = bills
    .slice()
    .sort((a, b) => (b.billingPeriod.end ?? "").localeCompare(a.billingPeriod.end ?? ""))[0];
  const gas = aggregateNaturalGasUsage(bills);
  const electricity = aggregateElectricityUsage(bills);

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
    profileConfidence: bills.reduce((sum, bill) => sum + bill.confidence, 0) / bills.length,
  };
}

function buildLiveEvidence(program: IncentiveProgram, household: HouseholdProfile): EligibilityEvidence[] {
  const evidence = evidenceFor(program, household).filter(
    (item) => item.criterion === "Region" || item.criterion === "Homeowner status",
  );
  evidence.push({
    criterion: "Program-specific requirements",
    observedValue: "Not yet confirmed",
    expectedValue: "User confirmation",
    status: "unknown",
    source: "User confirmation required",
  });
  return evidence;
}

export function matchOpportunitiesLive(bills: UtilityBillExtraction[], household: HouseholdProfile): Opportunity[] {
  return INCENTIVE_PROGRAMS.map((program) => {
    const evidence = buildLiveEvidence(program, household);
    const hasFail = evidence.some((item) => item.status === "fail");
    const hasUnknown = evidence.some((item) => item.status === "unknown");
    const status: Opportunity["status"] = hasFail ? "not_eligible" : hasUnknown ? "needs_answers" : "ready_to_pursue";
    const tenureUnresolved = evidence.some((item) => item.criterion === "Homeowner status" && item.status === "unknown");

    return {
      id: `opp-${program.id}`,
      incentiveId: program.id,
      title: program.name,
      category: program.category,
      ...estimateOpportunityEconomicsFromUsage(program, household, bills),
      eligibilityConfidence: hasFail ? 0.1 : 0.5,
      status,
      reasoningSummary: hasFail
        ? "Known program requirements do not match the current household facts."
        : "The uploaded bill was read successfully; confirm the remaining household and program requirements.",
      evidence,
      unresolvedQuestions: tenureUnresolved ? ["Do you own or rent this property?"] : [],
    };
  });
}
