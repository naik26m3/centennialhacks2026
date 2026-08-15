// SAMPLE DATA — synthetic Toronto household. Never a real account.
//
// Ported from the web app's fixtures so both clients tell the same story
// (brief §58). Program figures were verified against Enbridge Gas's published
// rebate pages as of 2026-08-15; re-verify before any real submission.
//
// Demo mode must be deterministic (brief §59, PRD §14).

import type { AgentEvent, HouseholdProfile, Opportunity, UtilityBillExtraction } from "./types";

export const DEMO_BILL: UtilityBillExtraction = {
  provider: "Enbridge Gas",
  accountType: "residential",
  serviceAddress: { city: "Toronto", provinceState: "Ontario", postalCode: "M4C ***", country: "Canada" },
  billingPeriod: { start: "2026-07-01", end: "2026-07-31" },
  electricity: null,
  naturalGas: { usageM3: 142, cost: 118.42 },
  totalAmount: 118.42,
  currency: "CAD",
  detectedHeatingClues: ["natural gas billing structure", "residential rate class"],
  confidence: 0.93,
  missingCriticalFields: [],
};

export const DEMO_HOUSEHOLD: HouseholdProfile = {
  id: "demo-household-1",
  country: "Canada",
  provinceState: "Ontario",
  city: "Toronto",
  dwellingType: "semi_detached",
  tenure: "unknown",
  primaryHeating: "natural_gas",
  utilityProvider: "Enbridge Gas",
  annualElectricityKwh: 8420,
  profileConfidence: 0.78,
};

const HRS_URL =
  "https://www.enbridgegas.com/ontario/rebates-energy-conservation/home-efficiency-rebate-plus";

export const DEMO_OPPORTUNITIES: Opportunity[] = [
  {
    id: "smart-thermostat",
    title: "Smart thermostat",
    category: "thermostat",
    estimatedIncentive: 75,
    estimatedUpfrontCost: 249,
    estimatedAnnualSavings: 74,
    estimatedPaybackYears: 2.4,
    estimatedCo2ReductionKg: 168,
    eligibilityConfidence: 0.96,
    effort: "low",
    status: "ready_to_pursue",
    reasoningSummary:
      "Your bill shows a residential Enbridge Gas account in Ontario, which matches this program's published requirements. No home assessment is required.",
    evidence: [
      { criterion: "Utility provider", observedValue: "Enbridge Gas", expectedValue: "Enbridge Gas", status: "pass", source: "Utility bill" },
      { criterion: "Province", observedValue: "Ontario", expectedValue: "Ontario", status: "pass", source: "Utility bill" },
      { criterion: "Account type", observedValue: "Residential", expectedValue: "Residential", status: "pass", source: "Utility bill" },
      { criterion: "Assessment required", observedValue: "Not required", expectedValue: "Not required", status: "pass", source: "Program page" },
    ],
    unresolvedQuestions: [],
    actionRoute: {
      routeType: "web_application",
      administeringOrganization: "Enbridge Gas",
      departmentOrProgram: "Home Renovation Savings program",
      applicationUrl: HRS_URL,
      sourceUrl: HRS_URL,
      sourceTitle: "Home Efficiency Rebate Plus | Ontario | Enbridge Gas",
      lastVerifiedAt: "2026-08-15",
      confidence: 0.95,
      verified: true,
    },
  },
  {
    id: "home-energy-assessment",
    title: "Home energy assessment",
    category: "assessment",
    estimatedIncentive: 600,
    estimatedUpfrontCost: 600,
    estimatedAnnualSavings: 0,
    estimatedPaybackYears: null,
    estimatedCo2ReductionKg: 0,
    eligibilityConfidence: 0.94,
    effort: "low",
    status: "ready_to_pursue",
    reasoningSummary:
      "Required first step before most Home Renovation Savings upgrades. The rebate covers the assessment cost, so the expected net cost is zero.",
    evidence: [
      { criterion: "Province", observedValue: "Ontario", expectedValue: "Ontario", status: "pass", source: "Utility bill" },
      { criterion: "Heating type", observedValue: "Natural gas", expectedValue: "Any", status: "pass", source: "Utility bill" },
      { criterion: "Homeowner status", observedValue: "Unknown", expectedValue: "Not required", status: "unknown", source: "Needs confirmation" },
    ],
    unresolvedQuestions: [],
    actionRoute: {
      routeType: "web_application",
      administeringOrganization: "Enbridge Gas / Save on Energy",
      departmentOrProgram: "Home Renovation Savings program",
      applicationUrl: HRS_URL,
      sourceUrl: HRS_URL,
      sourceTitle: "Home Efficiency Rebate Plus | Ontario | Enbridge Gas",
      lastVerifiedAt: "2026-08-15",
      confidence: 0.95,
      verified: true,
    },
  },
  {
    id: "attic-insulation",
    title: "Attic insulation",
    category: "insulation",
    estimatedIncentive: 1500,
    estimatedUpfrontCost: 2800,
    estimatedAnnualSavings: 210,
    estimatedPaybackYears: 6.2,
    estimatedCo2ReductionKg: 480,
    eligibilityConfidence: 0.81,
    effort: "medium",
    status: "needs_answers",
    reasoningSummary:
      "Gas-heated Ontario homes typically qualify, but the rebate amount depends on your current insulation level, which a home assessment must establish first.",
    evidence: [
      { criterion: "Province", observedValue: "Ontario", expectedValue: "Ontario", status: "pass", source: "Utility bill" },
      { criterion: "Heating type", observedValue: "Natural gas", expectedValue: "Gas, electric, oil or propane", status: "pass", source: "Utility bill" },
      { criterion: "Prior assessment", observedValue: "Not completed", expectedValue: "Required", status: "fail", source: "Program page" },
      { criterion: "Homeowner status", observedValue: "Unknown", expectedValue: "Owner", status: "unknown", source: "Needs confirmation" },
    ],
    unresolvedQuestions: ["Do you own or rent this property?", "What is your attic's current insulation level?"],
    actionRoute: {
      routeType: "web_application",
      administeringOrganization: "Enbridge Gas / Save on Energy",
      departmentOrProgram: "Home Renovation Savings program",
      applicationUrl: HRS_URL,
      sourceUrl: HRS_URL,
      sourceTitle: "Home Efficiency Rebate Plus | Ontario | Enbridge Gas",
      lastVerifiedAt: "2026-08-15",
      confidence: 0.9,
      verified: true,
    },
  },
  {
    id: "air-source-heat-pump",
    title: "Cold-climate heat pump",
    category: "heat_pump",
    estimatedIncentive: 7500,
    estimatedUpfrontCost: 16500,
    estimatedAnnualSavings: 640,
    estimatedPaybackYears: 14.1,
    estimatedCo2ReductionKg: 2100,
    eligibilityConfidence: 0.78,
    effort: "high",
    status: "needs_answers",
    reasoningSummary:
      "Your gas heating and Ontario address appear compatible with the published requirements. A home assessment and confirmed homeowner status are required before the rebate can be claimed.",
    evidence: [
      { criterion: "Province", observedValue: "Ontario", expectedValue: "Ontario", status: "pass", source: "Utility bill" },
      { criterion: "Heating type", observedValue: "Natural gas", expectedValue: "Gas, electric, oil or propane", status: "pass", source: "Utility bill" },
      { criterion: "Prior assessment", observedValue: "Not completed", expectedValue: "Required", status: "fail", source: "Program page" },
      { criterion: "Homeowner status", observedValue: "Unknown", expectedValue: "Owner", status: "unknown", source: "Needs confirmation" },
    ],
    unresolvedQuestions: ["Do you own or rent this property?", "Is your current furnace older than 15 years?"],
    actionRoute: {
      routeType: "web_application",
      administeringOrganization: "Enbridge Gas / Save on Energy",
      departmentOrProgram: "Home Renovation Savings program",
      applicationUrl: HRS_URL,
      sourceUrl: HRS_URL,
      sourceTitle: "Home Efficiency Rebate Plus | Ontario | Enbridge Gas",
      lastVerifiedAt: "2026-08-15",
      confidence: 0.9,
      verified: true,
    },
  },
];

/** Brief §10: the hero number is the total potential value found. */
export const TOTAL_VALUE_FOUND = DEMO_OPPORTUNITIES.reduce((sum, o) => sum + o.estimatedIncentive, 0);

/** Brief §9: the analysis sequence. Deterministic, 2–3s in demo mode. */
export const ANALYSIS_STEPS = [
  "Reading document",
  "Toronto, Ontario",
  "Residential gas account",
  "Utility provider detected",
  "Estimated annualized consumption: 1,704 m³",
  "Billing structure detected",
  "Building household profile",
  "Searching programs",
  "Resolving administrators and required actions",
];

/** Brief §13: observable agent actions, never chain-of-thought. */
export const DEMO_AGENT_EVENTS: AgentEvent[] = [
  { id: "1", group: "Program verification", title: "Current program requirements loaded", status: "complete" },
  { id: "2", group: "Household matching", title: "Province matches", status: "complete" },
  { id: "3", group: "Household matching", title: "Utility type matches", status: "complete" },
  { id: "4", group: "Household matching", title: "Homeowner status unresolved", status: "needs_human" },
  { id: "5", group: "Contact resolution", title: "Program administrator identified", status: "complete", detail: "Enbridge Gas, on behalf of the Government of Ontario" },
  { id: "6", group: "Contact resolution", title: "Correct action channel determined", status: "complete", detail: "Online application portal" },
  { id: "7", group: "Documentation", title: "Utility bill attached", status: "complete" },
  { id: "8", group: "Documentation", title: "Provider extracted", status: "complete" },
  { id: "9", group: "Documentation", title: "Proof of ownership missing", status: "blocked" },
  { id: "10", group: "Application", title: "9 fields completed", status: "complete" },
  { id: "11", group: "Application", title: "2 questions require you", status: "needs_human" },
];
