import assert from "node:assert/strict";
import test from "node:test";

import { mapCaseResult } from "../lib/results";

const caseId = "123e4567-e89b-12d3-a456-426614174000";

test("maps financing separately without adding it to savings", () => {
  const result = mapCaseResult({
    case_id: caseId,
    status: "ready",
    evaluations: [
      {
        evaluationId: "evaluation-id",
        programVersionId: "version-id",
        programKey: "toronto_help",
        programName: "Toronto HELP",
        eligibility: "eligible",
        confirmedRequirements: ["address"],
        missingRequirements: [],
        values: [
          {
            id: "financing-id",
            componentKey: "loan",
            benefitType: "financing",
            amount: "1000.00",
            currency: "CAD",
            cadence: "one_time",
            minimumAmount: null,
            maximumAmount: null,
            certainty: "confirmed",
            contributesToSavings: true,
            formulaVersion: "v1",
            sourceVersionId: "version-id",
          },
          {
            id: "rebate-id",
            componentKey: "rebate",
            benefitType: "rebate",
            amount: "200.50",
            currency: "CAD",
            cadence: "one_time",
            minimumAmount: null,
            maximumAmount: null,
            certainty: "estimated",
            contributesToSavings: true,
            formulaVersion: "v1",
            sourceVersionId: "version-id",
          },
        ],
        evidence: [],
      },
    ],
  });

  assert.equal(result.opportunities[0]?.values[0]?.amount, 1000);
  assert.deepEqual(result.financialSummary.savings, { min: 200.5, max: 200.5 });
  assert.deepEqual(result.financialSummary.financing, { min: 1000, max: 1000 });
  assert.deepEqual(result.financialSummary.netBenefit, { min: 200.5, max: 200.5 });
});

test("returns a safe empty result while processing or before evaluations exist", () => {
  assert.deepEqual(
    mapCaseResult({ case_id: caseId, status: "evaluating", evaluations: [] }),
    {
      caseId,
      status: "evaluating",
      opportunities: [],
      financialSummary: {
        savings: { min: null, max: null },
        financing: { min: null, max: null },
        upfrontCosts: { min: null, max: null },
        netBenefit: { min: null, max: null },
      },
    },
  );
});
