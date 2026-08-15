import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEligibility } from "../lib/eligibility";
import { calculateFinancialSummary } from "../lib/financial";

test("eligibility reports confirmed, failed, and missing requirements", () => {
  assert.equal(
    evaluateEligibility([
      { id: "postal", label: "Ontario postal prefix", outcome: "pass" },
      { id: "income", label: "Household income", outcome: "unknown" },
    ]).status,
    "likely_eligible",
  );

  const failed = evaluateEligibility([
    { id: "provider", outcome: "fail" },
    { id: "income", outcome: "pass" },
  ]);
  assert.equal(failed.status, "ineligible");
  assert.deepEqual(failed.failedRequirements, ["provider"]);
  assert.deepEqual(failed.confirmedRequirements, ["income"]);

  assert.equal(
    evaluateEligibility([{ id: "income", outcome: "manual_review" }]).status,
    "manual_review",
  );
  assert.equal(
    evaluateEligibility([{ id: "income", outcome: "unknown" }]).status,
    "possible_match",
  );
});

test("financial summary excludes financing and subtracts upfront costs", () => {
  const result = calculateFinancialSummary([
    {
      type: "rebate",
      min: 100,
      max: 200,
      cadence: "one_time",
      certainty: "verified",
      formulaVersion: "rebate-v1",
      sourceVersion: "source-v3",
      contributesToSavings: true,
    },
    {
      type: "financing",
      amount: 1_000,
      cadence: "one_time",
      certainty: "conditional",
      formulaVersion: "help-v1",
      sourceVersion: "source-v4",
      contributesToSavings: true,
    },
    {
      type: "upfront_cost",
      min: 20,
      max: 50,
      cadence: "one_time",
      certainty: "verified",
      formulaVersion: "quote-v1",
      sourceVersion: "quote-v1",
      contributesToSavings: false,
    },
  ]);

  assert.deepEqual(result.savings, { min: 100, max: 200 });
  assert.deepEqual(result.financing, { min: 1_000, max: 1_000 });
  assert.deepEqual(result.upfrontCosts, { min: 20, max: 50 });
  assert.deepEqual(result.netBenefit, { min: 50, max: 180 });
  assert.equal(result.components[0].sourceVersion, "source-v3");
});
