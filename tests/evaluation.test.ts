import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePrograms,
  evaluateCase,
  mapEligibilityRules,
  submitCaseAnswer,
} from "../lib/evaluation";

const caseId = "123e4567-e89b-12d3-a456-426614174000";
const versionId = "123e4567-e89b-12d3-a456-426614174001";

const program = {
  id: versionId,
  programKey: "home_help",
  programName: "Home Help",
  jurisdiction: "CA-ON",
  eligibilityRules: [
    {
      program_version_id: versionId,
      rule_key: "jurisdiction",
      rule_kind: "jurisdiction",
      definition: { fact: "jurisdiction", operator: "equals", value: "CA-ON" },
      required: true,
      sort_order: 0,
    },
    {
      program_version_id: versionId,
      rule_key: "household_size",
      rule_kind: "case_answer",
      definition: { fact: "household_size", operator: "gte", value: 2, question: "How many people live in your home?" },
      required: true,
      sort_order: 2,
    },
    {
      program_version_id: versionId,
      rule_key: "provider",
      rule_kind: "bill_fact",
      definition: { fact: "provider", operator: "equals", value: "Hydro" },
      required: true,
      sort_order: 1,
    },
  ],
  benefitRules: [
    {
      program_version_id: versionId,
      rule_key: "rebate",
      benefit_type: "rebate",
      definition: { amount: 100, cadence: "one_time", certainty: "confirmed", contributesToSavings: true },
      formula_version: "v1",
    },
    {
      program_version_id: versionId,
      rule_key: "loan",
      benefit_type: "financing",
      definition: { amount: 1000, cadence: "one_time", certainty: "confirmed", contributesToSavings: true },
      formula_version: "v1",
    },
  ],
} as const;

test("maps deterministic facts and asks only the highest-sort unresolved answer", () => {
  const rules = mapEligibilityRules(program.eligibilityRules, { provider: "Hydro" }, {});
  assert.deepEqual(rules.map((rule) => rule.outcome), ["pass", "pass", "unknown"]);

  const run = evaluatePrograms([program], { provider: "Hydro" }, {});
  assert.deepEqual(run.nextQuestion, {
    questionKey: "household_size",
    question: "How many people live in your home?",
  });
  assert.equal(run.status, "needs_review");
  assert.deepEqual(run.evaluations[0]?.financialSummary.savings, { min: 100, max: 100 });
  assert.deepEqual(run.evaluations[0]?.financialSummary.financing, { min: 1000, max: 1000 });
});

type FakeState = {
  answer: unknown;
  answerUpserts: number;
  evaluations: number;
  components: number;
  evidenceInserts: number;
  evidenceDeletes: number;
  owned?: boolean;
};

function fakeDatabase(state: FakeState) {
  const query = (async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const statement = strings.join(" ");
    if (statement.includes("SELECT id") && statement.includes("FROM cases")) return state.owned === false ? [] : [{ id: caseId }];
    if (statement.includes("INSERT INTO case_answers")) {
      state.answerUpserts += 1;
      state.answer = 2;
      return [];
    }
    if (statement.includes("FROM extracted_fields")) {
      return [
        { id: "123e4567-e89b-12d3-a456-426614174010", field_name: "provider", value: "Hydro", page_number: 1, bounding_box: { left: 0.1 }, review_status: "confirmed" },
        { id: "123e4567-e89b-12d3-a456-426614174011", field_name: "pending_total", value: 100, page_number: 1, bounding_box: null, review_status: "pending" },
      ];
    }
    if (statement.includes("SELECT question_key, answer")) return state.answer === undefined ? [] : [{ question_key: "household_size", answer: state.answer }];
    if (statement.includes("FROM program_versions pv")) return [{ id: versionId, program_key: "home_help", program_name: "Home Help", jurisdiction: "CA-ON" }];
    if (statement.includes("FROM eligibility_rules")) return program.eligibilityRules;
    if (statement.includes("FROM benefit_rules")) return program.benefitRules;
    if (statement.includes("INSERT INTO case_program_evaluations")) {
      state.evaluations += 1;
      return [{ id: "123e4567-e89b-12d3-a456-426614174002" }];
    }
    if (statement.includes("DELETE FROM evidence_items")) {
      state.evidenceDeletes += 1;
      return [];
    }
    if (statement.includes("INSERT INTO evidence_items")) {
      state.evidenceInserts += 1;
      return [];
    }
    if (statement.includes("INSERT INTO value_components")) {
      state.components += 1;
      return [];
    }
    return [];
  }) as ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>);
  return Object.assign(query, {
    begin: async <T>(callback: (sql: typeof query) => Promise<T>) => callback(query),
  });
}

test("answer and evaluations are upsert-safe across retries", async () => {
  const state: FakeState = { answer: undefined, answerUpserts: 0, evaluations: 0, components: 0, evidenceInserts: 0, evidenceDeletes: 0 };
  const db = fakeDatabase(state);
  const first = await submitCaseAnswer("user-1", caseId, { questionKey: "household_size", answer: 2 }, db as never);
  const retry = await submitCaseAnswer("user-1", caseId, { questionKey: "household_size", answer: 2 }, db as never);
  assert.equal(first.status, "ready");
  assert.equal(retry.nextQuestion, null);
  assert.equal(state.answer, 2);
  assert.equal(state.answerUpserts, 2);
  assert.equal(state.evaluations, 2);
  assert.equal(state.components, 4);
});

test("explicit evaluation runs without an answer and rebuilds only referenced bill evidence", async () => {
  const state: FakeState = { answer: undefined, answerUpserts: 0, evaluations: 0, components: 0, evidenceInserts: 0, evidenceDeletes: 0 };
  const db = fakeDatabase(state);
  const first = await evaluateCase("user-1", caseId, db as never);
  const retry = await evaluateCase("user-1", caseId, db as never);

  assert.equal(first.status, "needs_review");
  assert.deepEqual(first.nextQuestion, {
    questionKey: "household_size",
    question: "How many people live in your home?",
  });
  assert.equal(state.evidenceInserts, 2);
  assert.equal(state.evidenceDeletes, 2);
  assert.equal(retry.evaluations.length, 1);
});

test("explicit evaluation enforces case ownership", async () => {
  const state: FakeState = { answer: undefined, answerUpserts: 0, evaluations: 0, components: 0, evidenceInserts: 0, evidenceDeletes: 0, owned: false };
  await assert.rejects(
    evaluateCase("other-user", caseId, fakeDatabase(state) as never),
    /Case not found/,
  );
  assert.equal(state.evaluations, 0);
});
