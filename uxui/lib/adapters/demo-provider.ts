import { DEMO_BILL, DEMO_HOUSEHOLD, INCENTIVE_PROGRAMS } from "@/lib/data/fixtures";
import {
  AgentCase,
  AgentEvent,
  ApplicationField,
  EligibilityEvidence,
  HouseholdProfile,
  IncentiveProgram,
  Opportunity,
  Tenure,
  UtilityBillExtraction,
} from "@/lib/types";
import { estimateOpportunityEconomics } from "@/lib/calculations/payback";

// Deterministic demo-mode implementation of the analysis -> matching -> agent
// pipeline described in the brief. Every step here stands in for a Gemini call;
// each function's docstring says what the real call would do.

export function analyzeBillDemo(): UtilityBillExtraction {
  // Real equivalent: Gemini multimodal call reading the uploaded bill image,
  // validated against BillExtractionSchema (lib/ai/schemas.ts).
  return DEMO_BILL;
}

export function buildHouseholdProfile(): HouseholdProfile {
  return DEMO_HOUSEHOLD;
}

export function evidenceFor(program: IncentiveProgram, household: HouseholdProfile): EligibilityEvidence[] {
  const evidence: EligibilityEvidence[] = [];

  evidence.push({
    criterion: "Region",
    observedValue: household.provinceState,
    expectedValue: "Ontario",
    status: household.provinceState === "Ontario" ? "pass" : "fail",
    source: "Extracted from utility bill service address",
  });

  if (program.eligibility.heatingTypes !== "any") {
    const matches = program.eligibility.heatingTypes.includes(household.primaryHeating);
    evidence.push({
      criterion: "Heating type",
      observedValue: household.primaryHeating,
      expectedValue: program.eligibility.heatingTypes.join(" or "),
      status: matches ? "pass" : "fail",
      source: "Inferred from utility provider and billing structure",
    });
  }

  if (program.eligibility.requiresOwner) {
    evidence.push({
      criterion: "Homeowner status",
      observedValue: household.tenure,
      expectedValue: "owner",
      status: household.tenure === "unknown" ? "unknown" : household.tenure === "owner" ? "pass" : "fail",
      source: "Program eligibility rules — official page",
    });
  }

  if (program.eligibility.requiresAssessment) {
    evidence.push({
      criterion: "Home energy assessment",
      observedValue: "not yet booked",
      expectedValue: "required before this rebate can be claimed",
      status: "unknown",
      source: "Program eligibility rules — official page",
    });
  }

  return evidence;
}

export function matchOpportunities(household: HouseholdProfile): Opportunity[] {
  // Real equivalent: Gemini reasoning over the extracted bill + household profile
  // against the incentive dataset (Call 2 in the Claimly PRD's pipeline), producing
  // matches validated against EligibilityAssessmentSchema. Dollar math below is
  // always deterministic TypeScript, never model output.
  return INCENTIVE_PROGRAMS.map((program) => {
    const evidence = evidenceFor(program, household);
    const hasFail = evidence.some((e) => e.status === "fail");
    const hasUnknown = evidence.some((e) => e.status === "unknown");

    const status: Opportunity["status"] = hasFail ? "not_eligible" : hasUnknown ? "needs_answers" : "ready_to_pursue";
    const economics = estimateOpportunityEconomics(program);
    const confidence = hasFail ? 0.1 : hasUnknown ? 0.78 : 0.96;

    return {
      id: `opp-${program.id}`,
      incentiveId: program.id,
      title: program.name,
      category: program.category,
      ...economics,
      eligibilityConfidence: confidence,
      status,
      reasoningSummary:
        status === "not_eligible"
          ? "Program requirements don't appear to match this household."
          : status === "needs_answers"
          ? "Program requirements appear to match, pending a couple of confirmations."
          : "Program requirements appear to match based on the information available.",
      evidence,
      unresolvedQuestions: hasUnknown ? ["Do you own or rent this property?"] : [],
    };
  }).filter((o) => o.status !== "not_eligible" || true); // keep all, UI decides what to surface
}

export function resolveTenureAnswer(
  household: HouseholdProfile,
  tenure: Tenure,
  opportunities: Opportunity[]
): { household: HouseholdProfile; opportunities: Opportunity[] } {
  const updatedHousehold = { ...household, tenure, profileConfidence: 0.91 };
  const updatedOpportunities = opportunities.map((o) => {
    if (!o.unresolvedQuestions.includes("Do you own or rent this property?")) return o;
    const evidence = o.evidence.map((e) =>
      e.criterion === "Homeowner status"
        ? { ...e, observedValue: tenure, status: (tenure === "owner" ? "pass" : "fail") as EligibilityEvidence["status"] }
        : e
    );
    const hasFail = evidence.some((e) => e.status === "fail");
    return {
      ...o,
      evidence,
      status: hasFail ? "not_eligible" : ("ready_to_pursue" as Opportunity["status"]),
      eligibilityConfidence: hasFail ? 0.12 : 0.94,
      unresolvedQuestions: [],
    };
  });
  return { household: updatedHousehold, opportunities: updatedOpportunities };
}

export function buildAgentCase(opportunity: Opportunity, household: HouseholdProfile): AgentCase {
  const program = INCENTIVE_PROGRAMS.find((p) => p.id === opportunity.incentiveId)!;
  const needsHuman = opportunity.unresolvedQuestions.length > 0;

  const events: AgentEvent[] = [
    { id: "e1", sequence: 1, group: "Program verification", title: "Current program requirements loaded", status: "complete" },
    { id: "e2", sequence: 2, group: "Household matching", title: "Province matches", status: "complete" },
    { id: "e3", sequence: 3, group: "Household matching", title: "Utility type matches", status: "complete" },
    {
      id: "e4",
      sequence: 4,
      group: "Household matching",
      title: "Homeowner status",
      status: needsHuman ? "needs_human" : "complete",
      detail: needsHuman ? "Unresolved" : undefined,
    },
    { id: "e5", sequence: 5, group: "Contact resolution", title: "Program administrator identified", status: "complete" },
    { id: "e6", sequence: 6, group: "Contact resolution", title: "Correct action channel determined", status: "complete" },
    {
      id: "e7",
      sequence: 7,
      group: "Contact resolution",
      title: "Official contact verified",
      status: program.actionRoute.verified ? "complete" : "blocked",
    },
    { id: "e8", sequence: 8, group: "Documentation", title: "Utility bill attached", status: "complete" },
    { id: "e9", sequence: 9, group: "Documentation", title: "Provider extracted", status: "complete" },
    {
      id: "e10",
      sequence: 10,
      group: "Application",
      title: "Application fields prepared",
      status: needsHuman ? "needs_human" : "complete",
    },
  ];

  const applicationFields: ApplicationField[] = [
    { key: "provider", label: "Utility provider", value: household.utilityProvider ?? "", source: "extracted", requiresUserConfirmation: false },
    { key: "province", label: "Province", value: household.provinceState, source: "extracted", requiresUserConfirmation: false },
    { key: "dwelling", label: "Dwelling type", value: household.dwellingType, source: "extracted", requiresUserConfirmation: false },
    {
      key: "tenure",
      label: "Homeowner status",
      value: household.tenure === "unknown" ? "" : household.tenure,
      source: household.tenure === "unknown" ? "missing" : "confirmed",
      requiresUserConfirmation: household.tenure === "unknown",
    },
  ];

  const progress = needsHuman ? 0.65 : 0.9;

  const draftMessage =
    program.actionRoute.routeType === "email" && !needsHuman
      ? `Subject: Eligibility inquiry — ${program.name}\n\nHello,\n\nI'm a residential customer in ${household.city}, ${household.provinceState}, and based on the published requirements for the ${program.name}, I appear to meet the region and heating-type criteria. Could you confirm whether my household qualifies, and let me know the next step to apply?\n\nThank you,\n[Your name]`
      : null;

  return {
    id: `case-${opportunity.id}`,
    opportunityId: opportunity.id,
    status: needsHuman ? "awaiting_human" : "ready_for_review",
    progress,
    events,
    applicationFields,
    actionRoute: program.actionRoute,
    draftMessage,
  };
}
