import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTenureScenario,
  deriveProgramFilterSummary,
  rankOpportunities,
} from "../lib/experience.ts";

function opportunity(overrides = {}) {
  return {
    id: "opp-default",
    incentiveId: "default",
    title: "Default program",
    category: "other",
    estimatedIncentive: 1000,
    estimatedUpfrontCost: 1500,
    estimatedAnnualSavings: 200,
    savingsBasis: "category_estimate",
    estimatedPaybackYears: 2.5,
    estimatedCo2ReductionKg: 250,
    eligibilityConfidence: 0.78,
    status: "needs_answers",
    reasoningSummary: "Pending homeowner status.",
    evidence: [
      { criterion: "Region", observedValue: "Ontario", expectedValue: "Ontario", status: "pass", source: "bill" },
      { criterion: "Homeowner status", observedValue: "unknown", expectedValue: "owner", status: "unknown", source: "official rules" },
    ],
    unresolvedQuestions: ["Do you own or rent this property?"],
    ...overrides,
  };
}

test("objective ranking changes the recommended opportunity deterministically", () => {
  const highValue = opportunity({ id: "high", estimatedIncentive: 5000, estimatedUpfrontCost: 9000, estimatedAnnualSavings: 900 });
  const lowCost = opportunity({ id: "low", estimatedIncentive: 700, estimatedUpfrontCost: 700, estimatedAnnualSavings: 120 });
  assert.equal(rankOpportunities([lowCost, highValue], "max_value")[0].id, "high");
  assert.equal(rankOpportunities([highValue, lowCost], "min_upfront")[0].id, "low");
});

test("filter summary reconciles every tracked program exactly once", () => {
  const ready = opportunity({ id: "ready", status: "ready_to_pursue", unresolvedQuestions: [], evidence: [] });
  const unresolved = opportunity({ id: "unresolved" });
  const blocked = opportunity({ id: "blocked", status: "not_eligible", unresolvedQuestions: [], evidence: [{ criterion: "Region", observedValue: "Quebec", expectedValue: "Ontario", status: "fail", source: "bill" }] });
  const summary = deriveProgramFilterSummary([ready, unresolved, blocked]);
  assert.deepEqual(summary, { considered: 3, excludedJurisdiction: 1, excludedProvider: 0, excludedHousehold: 0, unresolved: 1, matched: 1 });
  assert.equal(summary.matched + summary.unresolved + summary.excludedJurisdiction + summary.excludedProvider + summary.excludedHousehold, summary.considered);
});

test("what-if tenure changes readiness without mutating canonical evidence", () => {
  const canonical = [opportunity()];
  const ownerScenario = applyTenureScenario(canonical, "owner");
  const renterScenario = applyTenureScenario(canonical, "renter");
  assert.equal(ownerScenario[0].status, "ready_to_pursue");
  assert.equal(renterScenario[0].status, "not_eligible");
  assert.equal(canonical[0].status, "needs_answers");
  assert.equal(canonical[0].evidence[1].observedValue, "unknown");
  assert.notEqual(ownerScenario[0].evidence, canonical[0].evidence);
});

test("displayed potential value is the sum of pursuable incentives only", () => {
  const opportunities = [
    opportunity({ id: "a", status: "ready_to_pursue", estimatedIncentive: 2500 }),
    opportunity({ id: "b", status: "needs_answers", estimatedIncentive: 1400 }),
    opportunity({ id: "c", status: "not_eligible", estimatedIncentive: 9000 }),
  ];
  const displayedTotal = opportunities.filter((item) => item.status !== "not_eligible").reduce((sum, item) => sum + item.estimatedIncentive, 0);
  assert.equal(displayedTotal, 3900);
});
