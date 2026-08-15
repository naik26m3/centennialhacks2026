import { getDatabase } from "@/lib/db";
import { CASE_STATUSES, type CaseStatus } from "@/lib/cases";

const ELIGIBILITY_STATUSES = new Set([
  "pass",
  "fail",
  "unknown",
  "manual_review",
  "likely_eligible",
  "possible_match",
  "ineligible",
  "eligible",
]);

type ResultRow = {
  case_id: string;
  status: string;
  evaluations: unknown;
};

type RawValue = {
  id?: unknown;
  componentKey?: unknown;
  benefitType?: unknown;
  amount?: unknown;
  currency?: unknown;
  cadence?: unknown;
  minimumAmount?: unknown;
  maximumAmount?: unknown;
  certainty?: unknown;
  contributesToSavings?: unknown;
  formulaVersion?: unknown;
  sourceVersionId?: unknown;
};

type RawEvidence = {
  id?: unknown;
  type?: unknown;
  pageNumber?: unknown;
  extractedFieldId?: unknown;
  sourceChunkId?: unknown;
};

type RawEvaluation = {
  evaluationId?: unknown;
  programVersionId?: unknown;
  programKey?: unknown;
  programName?: unknown;
  eligibility?: unknown;
  confirmedRequirements?: unknown;
  missingRequirements?: unknown;
  values?: unknown;
  evidence?: unknown;
};

export type ResultValue = {
  id: string;
  componentKey: string;
  type: string;
  amount: number | null;
  currency: string;
  cadence: string | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  certainty: string;
  contributesToSavings: boolean;
  formulaVersion: string;
  sourceVersionId: string | null;
};

export type EvidenceReference = {
  id: string;
  type: string;
  pageNumber: number | null;
  extractedFieldId: string | null;
  sourceChunkId: string | null;
};

export type FinancialRange = { min: number | null; max: number | null };

export type FinancialSummary = {
  savings: FinancialRange;
  financing: FinancialRange;
  upfrontCosts: FinancialRange;
  netBenefit: FinancialRange;
};

export type ResultOpportunity = {
  evaluationId: string;
  programVersionId: string;
  programKey: string;
  programName: string;
  eligibility: string;
  confirmedRequirements: string[];
  missingRequirements: string[];
  values: ResultValue[];
  evidence: EvidenceReference[];
  financialSummary: FinancialSummary;
};

export type CaseResult = {
  caseId: string;
  status: CaseStatus;
  opportunities: ResultOpportunity[];
  financialSummary: FinancialSummary;
};

export type CaseResultRow = ResultRow;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid result row JSON.");
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid result row field: ${field}`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return stringValue(value, field);
}

function numericValue(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid numeric result row field: ${field}`);
  return number;
}

function nullablePage(value: unknown): number | null {
  const page = numericValue(value, "pageNumber");
  return page === null ? null : Number.isInteger(page) && page > 0 ? page : null;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid result row JSON: ${field}`);
  return value.map((entry) => stringValue(entry, field));
}

function arrayValue(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid result row JSON: ${field}`);
  return value;
}

function mapValue(raw: unknown): ResultValue {
  const value = object(raw) as RawValue;
  return {
    id: stringValue(value.id, "value.id"),
    componentKey: stringValue(value.componentKey, "value.componentKey"),
    type: stringValue(value.benefitType, "value.benefitType"),
    amount: numericValue(value.amount, "value.amount"),
    currency: stringValue(value.currency, "value.currency"),
    cadence: optionalString(value.cadence, "value.cadence"),
    minimumAmount: numericValue(value.minimumAmount, "value.minimumAmount"),
    maximumAmount: numericValue(value.maximumAmount, "value.maximumAmount"),
    certainty: stringValue(value.certainty, "value.certainty"),
    contributesToSavings: value.contributesToSavings === true,
    formulaVersion: stringValue(value.formulaVersion, "value.formulaVersion"),
    sourceVersionId: optionalString(value.sourceVersionId, "value.sourceVersionId"),
  };
}

function mapEvidence(raw: unknown): EvidenceReference {
  const evidence = object(raw) as RawEvidence;
  return {
    id: stringValue(evidence.id, "evidence.id"),
    type: stringValue(evidence.type, "evidence.type"),
    pageNumber: nullablePage(evidence.pageNumber),
    extractedFieldId: optionalString(evidence.extractedFieldId, "evidence.extractedFieldId"),
    sourceChunkId: optionalString(evidence.sourceChunkId, "evidence.sourceChunkId"),
  };
}

function emptyRange(): FinancialRange {
  return { min: null, max: null };
}

function addRange(target: FinancialRange, low: number | null, high: number | null): void {
  if (low === null || high === null) return;
  target.min = (target.min ?? 0) + low;
  target.max = (target.max ?? 0) + high;
}

function summarize(values: readonly ResultValue[]): FinancialSummary {
  const summary: FinancialSummary = {
    savings: emptyRange(),
    financing: emptyRange(),
    upfrontCosts: emptyRange(),
    netBenefit: emptyRange(),
  };
  for (const value of values) {
    const low = value.minimumAmount ?? value.amount;
    const high = value.maximumAmount ?? value.amount;
    if (value.type === "financing") addRange(summary.financing, low, high);
    else if (value.type === "upfront_cost") addRange(summary.upfrontCosts, low, high);
    else if (value.contributesToSavings) addRange(summary.savings, low, high);
  }
  if (summary.savings.min !== null) {
    summary.netBenefit.min = summary.savings.min - (summary.upfrontCosts.max ?? 0);
  }
  if (summary.savings.max !== null) {
    summary.netBenefit.max = summary.savings.max - (summary.upfrontCosts.min ?? 0);
  }
  return summary;
}

function combineSummaries(summaries: readonly FinancialSummary[]): FinancialSummary {
  const result: FinancialSummary = {
    savings: emptyRange(),
    financing: emptyRange(),
    upfrontCosts: emptyRange(),
    netBenefit: emptyRange(),
  };
  for (const summary of summaries) {
    addRange(result.savings, summary.savings.min, summary.savings.max);
    addRange(result.financing, summary.financing.min, summary.financing.max);
    addRange(result.upfrontCosts, summary.upfrontCosts.min, summary.upfrontCosts.max);
  }
  if (result.savings.min !== null) {
    result.netBenefit.min = result.savings.min - (result.upfrontCosts.max ?? 0);
  }
  if (result.savings.max !== null) {
    result.netBenefit.max = result.savings.max - (result.upfrontCosts.min ?? 0);
  }
  return result;
}

function mapEvaluation(raw: unknown): ResultOpportunity {
  const evaluation = object(raw) as RawEvaluation;
  const eligibility = stringValue(evaluation.eligibility, "evaluation.eligibility");
  if (!ELIGIBILITY_STATUSES.has(eligibility)) throw new Error("Invalid evaluation eligibility.");
  const values = arrayValue(evaluation.values, "evaluation.values").map(mapValue);
  const opportunity: ResultOpportunity = {
    evaluationId: stringValue(evaluation.evaluationId, "evaluation.evaluationId"),
    programVersionId: stringValue(evaluation.programVersionId, "evaluation.programVersionId"),
    programKey: stringValue(evaluation.programKey, "evaluation.programKey"),
    programName: stringValue(evaluation.programName, "evaluation.programName"),
    eligibility,
    confirmedRequirements: stringArray(evaluation.confirmedRequirements, "confirmedRequirements"),
    missingRequirements: stringArray(evaluation.missingRequirements, "missingRequirements"),
    values,
    evidence: arrayValue(evaluation.evidence, "evaluation.evidence").map(mapEvidence),
    financialSummary: summarize(values),
  };
  return opportunity;
}

function mapStatus(value: unknown): CaseStatus {
  if (typeof value !== "string" || !(CASE_STATUSES as readonly string[]).includes(value)) {
    throw new Error("Invalid case result status.");
  }
  return value as CaseStatus;
}

export function mapCaseResult(row: CaseResultRow): CaseResult {
  const evaluations = arrayValue(row.evaluations, "evaluations").map(mapEvaluation);
  return {
    caseId: stringValue(row.case_id, "case_id"),
    status: mapStatus(row.status),
    opportunities: evaluations,
    financialSummary: combineSummaries(evaluations.map((evaluation) => evaluation.financialSummary)),
  };
}

export function mapCaseResultError(status: CaseStatus) {
  return status === "failed"
    ? { code: "processing_failed", message: "Case processing failed. Please retry.", retryable: true }
    : null;
}

export async function findOwnedCaseResult(clerkUserId: string, caseId: string): Promise<CaseResultRow | null> {
  const rows = await getDatabase()<ResultRow[]>`
    SELECT
      c.id::text AS case_id,
      c.status,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'evaluationId', e.id::text,
            'programVersionId', pv.id::text,
            'programKey', p.canonical_key,
            'programName', p.display_name,
            'eligibility', e.status,
            'confirmedRequirements', e.confirmed_requirements,
            'missingRequirements', e.missing_requirements,
            'values', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', vc.id::text,
                'componentKey', vc.component_key,
                'benefitType', vc.benefit_type,
                'amount', vc.amount,
                'currency', vc.currency,
                'cadence', vc.cadence,
                'minimumAmount', vc.minimum_amount,
                'maximumAmount', vc.maximum_amount,
                'certainty', vc.certainty,
                'contributesToSavings', vc.contributes_to_savings,
                'formulaVersion', vc.formula_version,
                'sourceVersionId', vc.source_version_id::text
              ) ORDER BY vc.component_key)
              FROM value_components vc
              WHERE vc.evaluation_id = e.id
            ), '[]'::jsonb),
            'evidence', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', ei.id::text,
                'type', ei.evidence_type,
                'pageNumber', ei.page_number,
                'extractedFieldId', ei.extracted_field_id::text,
                'sourceChunkId', ei.source_chunk_id::text
              ) ORDER BY ei.id)
              FROM evidence_items ei
              WHERE ei.case_id = c.id AND ei.evaluation_id = e.id
            ), '[]'::jsonb)
          ) ORDER BY p.canonical_key
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'::jsonb
      ) AS evaluations
    FROM cases c
    LEFT JOIN case_program_evaluations e ON e.case_id = c.id
    LEFT JOIN program_versions pv ON pv.id = e.program_version_id
    LEFT JOIN programs p ON p.id = pv.program_id
    WHERE c.id = ${caseId}
      AND c.clerk_user_id = ${clerkUserId}
      AND c.deleted_at IS NULL
    GROUP BY c.id, c.status
    LIMIT 1
  `;
  return rows[0] ?? null;
}
