// Core domain types for Greenlight, following the build brief's data model
// (sections 47-57). Trimmed to what the P0 demo path actually needs.

export type HeatingType =
  | "natural_gas"
  | "electric"
  | "heat_pump"
  | "oil"
  | "propane"
  | "unknown";

export type Tenure = "owner" | "renter" | "unknown";

export type OptimizationObjective =
  | "max_value"
  | "min_upfront"
  | "all_eligible"
  | "long_term_savings";

export interface ScenarioOverride {
  tenure?: "owner" | "renter";
  maxUpfrontCost?: number;
  objective?: OptimizationObjective;
}

export interface ProgramFilterSummary {
  considered: number;
  excludedJurisdiction: number;
  excludedProvider: number;
  excludedHousehold: number;
  unresolved: number;
  matched: number;
}

export interface TenureDecisionDelta {
  from: Tenure;
  to: "owner" | "renter";
  newlyReady: number;
  newlyBlocked: number;
}

export interface UtilityBillExtraction {
  provider: string | null;
  accountType: "residential" | "commercial" | "unknown";
  serviceAddress: {
    city: string | null;
    provinceState: string | null;
    postalCode: string | null;
    country: string | null;
  };
  billingPeriod: { start: string | null; end: string | null };
  electricity: { usageKwh: number | null; cost: number | null } | null;
  naturalGas: { usageM3: number | null; cost: number | null } | null;
  totalAmount: number | null;
  currency: string;
  // Gemini's own read on what the bill indicates the home heats with —
  // interpreting the bill's language (including negations like "no natural
  // gas service") is exactly what the model should do; a keyword scan over
  // detectedHeatingClues can't reliably tell affirmation from negation.
  primaryHeatingHint: HeatingType;
  detectedHeatingClues: string[];
  confidence: number;
  missingCriticalFields: string[];
}

export interface HouseholdProfile {
  id: string;
  country: string;
  provinceState: string;
  city: string | null;
  dwellingType:
    | "detached"
    | "semi_detached"
    | "townhouse"
    | "condo"
    | "apartment"
    | "other"
    | "unknown";
  tenure: Tenure;
  primaryHeating: HeatingType;
  utilityProvider: string | null;
  annualElectricityKwh: number | null;
  annualNaturalGasM3: number | null;
  // How many uploaded bill-months informed the annualized usage figures above,
  // per fuel — surfaced in the UI so an annualized-from-2-months estimate
  // isn't presented as if it were a real 12-month figure.
  monthsOfDataUsed: { electricity: number; naturalGas: number };
  existingEquipment: {
    smartThermostat: boolean;
    heatPump: boolean;
  };
  profileConfidence: number;
}

export type RouteType =
  | "email"
  | "web_application"
  | "utility_portal"
  | "government_portal"
  | "phone"
  | "manual_review";

export interface ActionRoute {
  routeType: RouteType;
  administeringOrganization: string;
  departmentOrProgram?: string;
  contact?: {
    email?: string;
    phone?: string;
    contactName?: string;
  };
  applicationUrl?: string;
  preferredSubmissionMethod?: string;
  sourceUrl: string;
  sourceTitle?: string;
  lastVerifiedAt: string;
  confidence: number;
  notes?: string[];
  verified: boolean;
}

export interface IncentiveProgram {
  id: string;
  name: string;
  provider: string;
  administeringOrganization: string;
  category: "assessment" | "heat_pump" | "insulation" | "thermostat" | "financing" | "other";
  description: string;
  amountMin: number;
  amountMax: number;
  currency: string;
  eligibility: {
    heatingTypes: HeatingType[] | "any";
    requiresAssessment: boolean;
    requiresOwner: boolean;
  };
  effort: "low" | "medium" | "high";
  actionRoute: ActionRoute;
  officialUrl: string;
  lastVerifiedAt: string;
}

export type EvidenceStatus = "pass" | "fail" | "unknown" | "manual_review";

export interface EligibilityEvidence {
  criterion: string;
  observedValue: string;
  expectedValue: string;
  status: EvidenceStatus;
  source: string;
}

export interface Opportunity {
  id: string;
  incentiveId: string;
  title: string;
  category: IncentiveProgram["category"];
  estimatedIncentive: number;
  estimatedUpfrontCost: number;
  estimatedAnnualSavings: number;
  // Whether estimatedAnnualSavings came from real usage math (this household's
  // own bill data) or a generic per-category constant — surfaced in the UI so
  // the two are never presented as equally precise.
  savingsBasis: "usage_derived" | "category_estimate";
  estimatedPaybackYears: number | null;
  estimatedCo2ReductionKg: number;
  eligibilityConfidence: number;
  status: "ready_to_pursue" | "needs_answers" | "not_eligible";
  reasoningSummary: string;
  evidence: EligibilityEvidence[];
  unresolvedQuestions: string[];
}

export type AgentEventStatus = "complete" | "in_progress" | "needs_human" | "blocked";

export interface AgentEvent {
  id: string;
  sequence: number;
  group: string;
  title: string;
  status: AgentEventStatus;
  detail?: string;
}

export interface ApplicationField {
  key: string;
  label: string;
  value: string;
  source: "extracted" | "confirmed" | "calculated" | "missing" | "declaration";
  requiresUserConfirmation: boolean;
}

export interface AgentCase {
  id: string;
  opportunityId: string;
  status: "in_progress" | "awaiting_human" | "ready_for_review";
  progress: number;
  events: AgentEvent[];
  applicationFields: ApplicationField[];
  actionRoute: ActionRoute | null;
  draftMessage: string | null;
}

export interface UserGoal {
  rawPrompt: string;
  objective: OptimizationObjective;
  maxUpfrontCost: number | null;
  minimumAnnualSavings: number | null;
  jurisdiction: string;
}

export interface NegotiatedPlanItem {
  opportunityId: string;
  title: string;
  upfrontCost: number;
  incentive: number;
  annualSavings: number;
}

export interface NegotiatedPlan {
  items: NegotiatedPlanItem[];
  budgetCeiling: number | null;
  estimatedUpfrontCost: number;
  potentialFirstYearValue: number;
  estimatedAnnualSavings: number;
  estimatedCo2ReductionKg: number;
  constraintSatisfied: boolean | null;
}
