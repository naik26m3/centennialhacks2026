export type RuleOutcome = "pass" | "fail" | "unknown" | "manual_review";

export type EligibilityStatus =
  | "eligible"
  | "ineligible"
  | "likely_eligible"
  | "possible_match"
  | "manual_review";

export type EligibilityRule = {
  id: string;
  label?: string;
  outcome: RuleOutcome;
  /** Rules are required unless explicitly marked optional. */
  required?: boolean;
};

export type EligibilityEvaluation = {
  status: EligibilityStatus;
  confirmedRequirements: string[];
  failedRequirements: string[];
  missingRequirements: string[];
  manualReviewRequirements: string[];
  /** A deterministic coverage measure, never a probability. */
  evidenceCoverage: number;
  rules: EligibilityRule[];
};

export type EligibilityInput = {
  rules: readonly EligibilityRule[];
  evidenceCoverage?: number;
};

function requirementLabel(rule: EligibilityRule): string {
  return rule.label?.trim() || rule.id;
}

function isEligibilityInput(
  input: EligibilityInput | readonly EligibilityRule[],
): input is EligibilityInput {
  return !Array.isArray(input);
}

function coverageFor(
  requiredRules: readonly EligibilityRule[],
  evidenceCoverage: number | undefined,
): number {
  if (evidenceCoverage !== undefined) {
    if (!Number.isFinite(evidenceCoverage)) {
      throw new TypeError("evidenceCoverage must be a finite number.");
    }
    return Math.min(1, Math.max(0, evidenceCoverage));
  }

  if (requiredRules.length === 0) return 1;
  return requiredRules.filter((rule) => rule.outcome === "pass").length / requiredRules.length;
}

/**
 * Roll up deterministic rule outcomes. Unknown stays unknown; it is never
 * converted into an AI confidence score.
 */
export function evaluateEligibility(
  input: EligibilityInput | readonly EligibilityRule[],
  options: { evidenceCoverage?: number } = {},
): EligibilityEvaluation {
  const rules: readonly EligibilityRule[] = isEligibilityInput(input) ? input.rules : input;
  const explicitCoverage = isEligibilityInput(input)
    ? input.evidenceCoverage
    : options.evidenceCoverage;
  const requiredRules = rules.filter((rule) => rule.required !== false);
  const coverage = coverageFor(requiredRules, explicitCoverage);

  const confirmedRequirements = rules
    .filter((rule) => rule.outcome === "pass")
    .map(requirementLabel);
  const failedRequirements = rules
    .filter((rule) => rule.outcome === "fail")
    .map(requirementLabel);
  const missingRequirements = rules
    .filter((rule) => rule.outcome === "unknown")
    .map(requirementLabel);
  const manualReviewRequirements = rules
    .filter((rule) => rule.outcome === "manual_review")
    .map(requirementLabel);

  const failedRequired = requiredRules.some((rule) => rule.outcome === "fail");
  const manualReviewRequired = requiredRules.some((rule) => rule.outcome === "manual_review");
  const missingRequired = requiredRules.some((rule) => rule.outcome === "unknown");

  let status: EligibilityStatus = "eligible";
  if (failedRequired) status = "ineligible";
  else if (manualReviewRequired) status = "manual_review";
  else if (missingRequired) status = coverage >= 0.5 ? "likely_eligible" : "possible_match";

  return {
    status,
    confirmedRequirements,
    failedRequirements,
    missingRequirements,
    manualReviewRequirements,
    evidenceCoverage: coverage,
    rules: [...rules],
  };
}
