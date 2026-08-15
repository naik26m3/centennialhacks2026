import { getDatabase, type Database } from "@/lib/db";
import { evaluateEligibility, type EligibilityEvaluation, type EligibilityRule } from "@/lib/eligibility";
import { calculateFinancialSummary, type FinancialSummary } from "@/lib/financial";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const IDEMPOTENCY_PATTERN = /^[\x21-\x7e]{1,128}$/;
const OPERATORS = new Set(["equals", "one_of", "present", "lte", "gte"]);
const CADENCES = new Set(["one_time", "monthly", "annual", "other"]);
const CERTAINTIES = new Set(["confirmed", "estimated", "conditional", "unknown"]);

export class EvaluationInputError extends Error {}
export class EvaluationNotFoundError extends Error {}

export type RuleDefinition = {
  fact: string;
  operator: "equals" | "one_of" | "present" | "lte" | "gte";
  value?: unknown;
  question?: string;
};

export type EligibilityRuleRow = {
  id?: string;
  program_version_id: string;
  rule_key: string;
  rule_kind: string;
  definition: unknown;
  required: boolean;
  sort_order: number;
};

export type BenefitRuleRow = {
  id?: string;
  program_version_id: string;
  rule_key: string;
  benefit_type: string;
  definition: unknown;
  formula_version: string;
};

export type ProgramVersionInput = {
  id: string;
  programKey: string;
  programName: string;
  jurisdiction: string;
  eligibilityRules: readonly EligibilityRuleRow[];
  benefitRules: readonly BenefitRuleRow[];
};

export type NextQuestion = { questionKey: string; question: string };

export type EvaluationValue = {
  componentKey: string;
  benefitType: string;
  amount: number | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  cadence: string | null;
  certainty: string;
  contributesToSavings: boolean;
  formulaVersion: string;
};

export type ProgramEvaluationSummary = {
  programVersionId: string;
  programKey: string;
  programName: string;
  eligibility: EligibilityEvaluation;
  values: EvaluationValue[];
  financialSummary: FinancialSummary;
};

export type EvaluationRun = {
  evaluations: ProgramEvaluationSummary[];
  nextQuestion: NextQuestion | null;
  status: "ready" | "needs_review";
};

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
type TransactionalDatabase = Sql & {
  begin: <T>(callback: (sql: Sql) => Promise<T>) => Promise<T>;
};

function database(value?: Database): TransactionalDatabase {
  return (value ?? getDatabase()) as unknown as TransactionalDatabase;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
  }
  const leftObject = record(left);
  const rightObject = record(right);
  if (!leftObject || !rightObject) return false;
  const keys = Object.keys(leftObject);
  return keys.length === Object.keys(rightObject).length
    && keys.every((key) => hasOwn(rightObject, key) && sameValue(leftObject[key], rightObject[key]));
}

function validDefinition(value: unknown): value is RuleDefinition {
  const definition = record(value);
  if (!definition || typeof definition.fact !== "string" || !KEY_PATTERN.test(definition.fact)) return false;
  if (typeof definition.operator !== "string" || !OPERATORS.has(definition.operator)) return false;
  if (definition.question !== undefined && typeof definition.question !== "string") return false;
  if (definition.operator !== "present" && !hasOwn(definition, "value")) return false;
  if (definition.operator === "present" && hasOwn(definition, "value")) return false;
  if (definition.operator === "one_of" && (!Array.isArray(definition.value) || definition.value.length === 0)) return false;
  return true;
}

function compare(left: unknown, right: unknown, operator: "lte" | "gte"): boolean | null {
  if (typeof left === "number" && typeof right === "number" && Number.isFinite(left) && Number.isFinite(right)) {
    return operator === "lte" ? left <= right : left >= right;
  }
  if (typeof left === "string" && typeof right === "string" && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(left) && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(right)) {
    return operator === "lte" ? left <= right : left >= right;
  }
  return null;
}

function outcomeFor(
  kind: string,
  definitionValue: unknown,
  facts: Readonly<Record<string, unknown>>,
): EligibilityRule["outcome"] {
  if (kind === "manual_review") return "manual_review";
  if (kind === "jurisdiction") {
    if (!validDefinition(definitionValue)) return "manual_review";
    return definitionValue.operator === "equals" && definitionValue.value === "CA-ON"
      ? "pass"
      : "manual_review";
  }
  if (kind !== "bill_fact" && kind !== "case_answer") return "manual_review";
  if (!validDefinition(definitionValue)) return "manual_review";

  const definition = definitionValue;
  if (!hasOwn(facts, definition.fact)) return "unknown";
  const fact = facts[definition.fact];
  switch (definition.operator) {
    case "present":
      return fact !== null && fact !== undefined && !(typeof fact === "string" && fact.trim() === "")
        ? "pass"
        : "fail";
    case "equals":
      return sameValue(fact, definition.value) ? "pass" : "fail";
    case "one_of":
      return (definition.value as unknown[]).some((candidate) => sameValue(fact, candidate)) ? "pass" : "fail";
    case "lte":
    case "gte": {
      const result = compare(fact, definition.value, definition.operator);
      return result === null ? "manual_review" : result ? "pass" : "fail";
    }
  }
}

/** Map reviewed registry definitions to the shared deterministic engine contract. */
export function mapEligibilityRules(
  rules: readonly EligibilityRuleRow[],
  fields: Readonly<Record<string, unknown>>,
  answers: Readonly<Record<string, unknown>>,
): EligibilityRule[] {
  return [...rules]
    .sort((left, right) => left.sort_order - right.sort_order || left.rule_key.localeCompare(right.rule_key))
    .map((rule) => ({
      id: rule.rule_key,
      label: validDefinition(rule.definition) && rule.definition.question
        ? rule.definition.question
        : rule.rule_key,
      required: rule.required,
      outcome: outcomeFor(
        rule.rule_kind,
        rule.definition,
        rule.rule_kind === "case_answer" ? answers : fields,
      ),
    }));
}

function finiteAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function valueFromBenefit(rule: BenefitRuleRow): EvaluationValue {
  const definition = record(rule.definition);
  const amount = finiteAmount(definition?.amount);
  const minimumAmount = finiteAmount(definition?.minimumAmount);
  const maximumAmount = finiteAmount(definition?.maximumAmount);
  const hasFixedAmount = amount !== null;
  const hasRange = minimumAmount !== null && maximumAmount !== null && minimumAmount <= maximumAmount;
  const usableAmount = hasFixedAmount || hasRange;
  const cadence = typeof definition?.cadence === "string" && CADENCES.has(definition.cadence)
    ? definition.cadence
    : null;
  const certainty = typeof definition?.certainty === "string" && CERTAINTIES.has(definition.certainty) && usableAmount
    ? definition.certainty
    : "unknown";
  const contributesToSavings = rule.benefit_type !== "financing"
    && rule.benefit_type !== "upfront_cost"
    && definition?.contributesToSavings === true;
  return {
    componentKey: rule.rule_key,
    benefitType: rule.benefit_type,
    amount: hasFixedAmount ? amount : null,
    minimumAmount: hasFixedAmount ? null : hasRange ? minimumAmount : null,
    maximumAmount: hasFixedAmount ? null : hasRange ? maximumAmount : null,
    cadence,
    certainty,
    contributesToSavings,
    formulaVersion: rule.formula_version,
  };
}

function financialSummary(values: readonly EvaluationValue[]): FinancialSummary {
  const calculable = values.flatMap((value) => {
    if (value.cadence === null || value.certainty === "unknown") return [];
    if (value.amount === null && (value.minimumAmount === null || value.maximumAmount === null)) return [];
    return [{
      type: value.benefitType,
      amount: value.amount ?? undefined,
      min: value.minimumAmount ?? undefined,
      max: value.maximumAmount ?? undefined,
      cadence: value.cadence,
      certainty: value.certainty,
      formulaVersion: value.formulaVersion,
      sourceVersion: "registry",
      contributesToSavings: value.contributesToSavings,
    }];
  });
  return calculateFinancialSummary(calculable);
}

function nextQuestion(programs: readonly ProgramVersionInput[], fields: Readonly<Record<string, unknown>>, answers: Readonly<Record<string, unknown>>): NextQuestion | null {
  const candidates = programs.flatMap((program) => program.eligibilityRules
    .filter((rule) => rule.rule_kind === "case_answer" && rule.required !== false)
    .map((rule) => ({ programKey: program.programKey, rule, outcome: outcomeFor(rule.rule_kind, rule.definition, answers) }))
    .filter((entry) => entry.outcome === "unknown" && validDefinition(entry.rule.definition)));
  candidates.sort((left, right) => right.rule.sort_order - left.rule.sort_order
    || left.programKey.localeCompare(right.programKey)
    || left.rule.rule_key.localeCompare(right.rule.rule_key));
  const candidate = candidates[0];
  if (!candidate || !validDefinition(candidate.rule.definition)) return null;
  return {
    questionKey: candidate.rule.rule_key,
    question: candidate.rule.definition.question?.trim() || candidate.rule.rule_key,
  };
}

export function evaluatePrograms(
  programs: readonly ProgramVersionInput[],
  fields: Readonly<Record<string, unknown>> = {},
  answers: Readonly<Record<string, unknown>> = {},
): EvaluationRun {
  const reviewRequired: boolean[] = [];
  const evaluations = programs.map((program) => {
    const rules = mapEligibilityRules(program.eligibilityRules, fields, answers);
    const eligibility = evaluateEligibility(rules);
    reviewRequired.push(rules.some((rule) => rule.required !== false && (rule.outcome === "unknown" || rule.outcome === "manual_review")));
    const values = program.benefitRules.map(valueFromBenefit);
    return {
      programVersionId: program.id,
      programKey: program.programKey,
      programName: program.programName,
      eligibility,
      values,
      financialSummary: financialSummary(values),
    };
  });
  const question = nextQuestion(programs, fields, answers);
  const status = question || reviewRequired.some(Boolean)
    ? "needs_review"
    : "ready";
  return { evaluations, nextQuestion: question, status };
}

function parseCaseAnswer(value: unknown, field: string): string {
  if (typeof value !== "string" || !KEY_PATTERN.test(value)) {
    throw new EvaluationInputError(`${field} must be a lowercase identifier.`);
  }
  return value;
}

function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_PATTERN.test(value.trim())) {
    throw new EvaluationInputError("idempotencyKey must contain 1–128 printable characters.");
  }
  return value.trim();
}

export function parseAnswerInput(value: unknown): { questionKey: string; answer: unknown; idempotencyKey: string | null } {
  const input = record(value);
  if (!input) throw new EvaluationInputError("Request body must be a JSON object.");
  const questionKey = parseCaseAnswer(input.questionKey, "questionKey");
  if (!hasOwn(input, "answer")) throw new EvaluationInputError("answer is required.");
  const idempotencyKey = input.idempotencyKey === undefined ? null : parseIdempotencyKey(input.idempotencyKey);
  return { questionKey, answer: input.answer, idempotencyKey };
}

export function parseEvaluationCaseId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new EvaluationInputError("Case id must be a valid UUID.");
  return value;
}

type CaseFieldRow = { field_name: string; value: unknown };
type CaseAnswerRow = { question_key: string; answer: unknown };
type VersionRow = { id: string; program_key: string; program_name: string; jurisdiction: string };

function objectMap(rows: readonly { key: string; value: unknown }[]): Record<string, unknown> {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function submitCaseAnswer(
  userId: string,
  caseId: string,
  input: { questionKey: string; answer: unknown; idempotencyKey?: string | null },
  db?: Database,
): Promise<{ caseId: string; status: EvaluationRun["status"]; evaluations: ProgramEvaluationSummary[]; nextQuestion: NextQuestion | null }> {
  parseEvaluationCaseId(caseId);
  const questionKey = parseCaseAnswer(input.questionKey, "questionKey");
  const dbClient = database(db);
  return dbClient.begin(async (sql) => {
    const owned = await sql`
      SELECT id
      FROM cases
      WHERE id = ${caseId} AND clerk_user_id = ${userId} AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (!owned[0]) throw new EvaluationNotFoundError("Case not found.");

    await sql`
      INSERT INTO case_answers (case_id, question_key, answer, source)
      VALUES (${caseId}, ${questionKey}, ${JSON.stringify(input.answer)}::jsonb, 'user')
      ON CONFLICT (case_id, question_key) DO UPDATE
      SET answer = EXCLUDED.answer, source = 'user', answered_at = now(), updated_at = now()
    `;

    const [fieldRows, answerRows, versionRows, ruleRows, benefitRows] = await Promise.all([
      sql`
        SELECT field_name, value
        FROM extracted_fields
        WHERE case_id = ${caseId} AND review_status IN ('confirmed', 'corrected')
        ORDER BY field_name
      `,
      sql`
        SELECT question_key, answer
        FROM case_answers
        WHERE case_id = ${caseId}
        ORDER BY question_key
      `,
      sql`
        SELECT pv.id::text AS id, p.canonical_key AS program_key,
               p.display_name AS program_name, p.jurisdiction
        FROM program_versions pv
        JOIN programs p ON p.id = pv.program_id
        WHERE pv.status = 'current' AND p.jurisdiction = 'CA-ON'
        ORDER BY p.canonical_key
      `,
      sql`
        SELECT er.program_version_id::text, er.rule_key, er.rule_kind,
               er.definition, er.required, er.sort_order
        FROM eligibility_rules er
        JOIN program_versions pv ON pv.id = er.program_version_id
        JOIN programs p ON p.id = pv.program_id
        WHERE pv.status = 'current' AND p.jurisdiction = 'CA-ON'
        ORDER BY er.program_version_id, er.sort_order, er.rule_key
      `,
      sql`
        SELECT br.program_version_id::text, br.rule_key, br.benefit_type,
               br.definition, br.formula_version
        FROM benefit_rules br
        JOIN program_versions pv ON pv.id = br.program_version_id
        JOIN programs p ON p.id = pv.program_id
        WHERE pv.status = 'current' AND p.jurisdiction = 'CA-ON'
        ORDER BY br.program_version_id, br.rule_key
      `,
    ]);
    const fields = objectMap((fieldRows as CaseFieldRow[]).map((row) => ({ key: row.field_name, value: row.value })));
    const answers = objectMap((answerRows as CaseAnswerRow[]).map((row) => ({ key: row.question_key, value: row.answer })));
    const programs = (versionRows as VersionRow[]).map((version) => ({
      id: version.id,
      programKey: version.program_key,
      programName: version.program_name,
      jurisdiction: version.jurisdiction,
      eligibilityRules: (ruleRows as EligibilityRuleRow[]).filter((rule) => rule.program_version_id === version.id),
      benefitRules: (benefitRows as BenefitRuleRow[]).filter((rule) => rule.program_version_id === version.id),
    }));
    if (!programs.some((program) => program.eligibilityRules.some((rule) => rule.rule_kind === "case_answer" && rule.rule_key === questionKey))) {
      throw new EvaluationInputError("questionKey is not a current case question.");
    }
    const run = evaluatePrograms(programs, fields, answers);

    for (const evaluation of run.evaluations) {
      const saved = await sql`
        INSERT INTO case_program_evaluations
          (case_id, program_version_id, status, confirmed_requirements, missing_requirements, input_snapshot, engine_version)
        VALUES
          (${caseId}, ${evaluation.programVersionId}, ${evaluation.eligibility.status},
           ${JSON.stringify(evaluation.eligibility.confirmedRequirements)}::jsonb,
           ${JSON.stringify(evaluation.eligibility.missingRequirements)}::jsonb,
           ${JSON.stringify({ fields, answers })}::jsonb, 'deterministic-v1')
        ON CONFLICT (case_id, program_version_id) DO UPDATE SET
          status = EXCLUDED.status,
          confirmed_requirements = EXCLUDED.confirmed_requirements,
          missing_requirements = EXCLUDED.missing_requirements,
          input_snapshot = EXCLUDED.input_snapshot,
          engine_version = EXCLUDED.engine_version,
          evaluated_at = now(), updated_at = now()
        RETURNING id::text AS id
      `;
      const evaluationId = String((saved[0] as { id?: string } | undefined)?.id ?? "");
      if (!evaluationId) throw new Error("Evaluation could not be stored.");
      await sql`DELETE FROM value_components WHERE evaluation_id = ${evaluationId}`;
      for (const value of evaluation.values) {
        await sql`
          INSERT INTO value_components
            (evaluation_id, component_key, benefit_type, amount, cadence,
             minimum_amount, maximum_amount, certainty, contributes_to_savings,
             formula_version, source_version_id)
          VALUES
            (${evaluationId}, ${value.componentKey}, ${value.benefitType}, ${value.amount},
             ${value.cadence}, ${value.minimumAmount}, ${value.maximumAmount}, ${value.certainty},
             ${value.contributesToSavings}, ${value.formulaVersion}, ${evaluation.programVersionId})
          ON CONFLICT (evaluation_id, component_key) DO UPDATE SET
            benefit_type = EXCLUDED.benefit_type, amount = EXCLUDED.amount,
            cadence = EXCLUDED.cadence, minimum_amount = EXCLUDED.minimum_amount,
            maximum_amount = EXCLUDED.maximum_amount, certainty = EXCLUDED.certainty,
            contributes_to_savings = EXCLUDED.contributes_to_savings,
            formula_version = EXCLUDED.formula_version, source_version_id = EXCLUDED.source_version_id,
            updated_at = now()
        `;
      }
    }
    await sql`
      UPDATE cases
      SET status = ${run.status}::case_status
      WHERE id = ${caseId} AND clerk_user_id = ${userId} AND deleted_at IS NULL
    `;
    return { caseId, status: run.status, evaluations: run.evaluations, nextQuestion: run.nextQuestion };
  });
}
