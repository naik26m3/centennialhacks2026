// Domain types, kept aligned with the web app's lib/types.ts and the PRD's
// canonical contracts. When the backend's OCR contract lands, the bill shape
// here should be replaced by an import from it rather than re-declared.

export type HeatingType = "natural_gas" | "electric" | "heat_pump" | "oil" | "propane" | "unknown";

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
  detectedHeatingClues: string[];
  confidence: number;
  missingCriticalFields: string[];
}

export interface HouseholdProfile {
  id: string;
  country: string;
  provinceState: string;
  city: string | null;
  dwellingType: "detached" | "semi_detached" | "townhouse" | "condo" | "apartment" | "other" | "unknown";
  tenure: "owner" | "renter" | "unknown";
  primaryHeating: HeatingType;
  utilityProvider: string | null;
  annualElectricityKwh: number | null;
  profileConfidence: number;
}

export type EvidenceStatus = "pass" | "fail" | "unknown" | "manual_review";

export interface EligibilityEvidence {
  criterion: string;
  observedValue: string;
  expectedValue: string;
  status: EvidenceStatus;
  source: string;
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
  applicationUrl?: string;
  sourceUrl: string;
  sourceTitle?: string;
  lastVerifiedAt: string;
  confidence: number;
  verified: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  category: "assessment" | "heat_pump" | "insulation" | "thermostat" | "financing" | "other";
  estimatedIncentive: number;
  estimatedUpfrontCost: number;
  estimatedAnnualSavings: number;
  estimatedPaybackYears: number | null;
  estimatedCo2ReductionKg: number;
  eligibilityConfidence: number;
  effort: "low" | "medium" | "high";
  status: "ready_to_pursue" | "needs_answers" | "not_eligible";
  reasoningSummary: string;
  evidence: EligibilityEvidence[];
  unresolvedQuestions: string[];
  actionRoute: ActionRoute;
}

export type AgentEventStatus = "complete" | "in_progress" | "needs_human" | "blocked";

export interface AgentEvent {
  id: string;
  group: string;
  title: string;
  status: AgentEventStatus;
  detail?: string;
}
