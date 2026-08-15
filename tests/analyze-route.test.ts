import assert from "node:assert/strict";
import test from "node:test";

import { toUtilityBillExtraction } from "../app/api/analyze/route";
import type { CanonicalBillOcr } from "../lib/ocr";

function bill(provider: string | null, usage: { value: number; unit: string | null } | null): CanonicalBillOcr {
  return {
    provider: { value: provider, confidence: 90, evidence: [] },
    billingPeriod: { value: { start: "2026-04-01", end: "2026-04-30" }, confidence: 80, evidence: [] },
    total: { value: 123.45, confidence: 70, evidence: [] },
    usage: { value: usage, confidence: 60, evidence: [] },
    accountNumber: { value: null, confidence: null, evidence: [] },
  };
}

test("maps canonical OpenRouter OCR fields without inventing unavailable bill data", () => {
  const electricity = toUtilityBillExtraction(bill("Toronto Hydro", { value: 456.7, unit: "kWh" }));
  assert.deepEqual(electricity.electricity, { usageKwh: 456.7, cost: 123.45 });
  assert.equal(electricity.naturalGas, null);
  assert.equal(electricity.confidence, 0.75);
  assert.deepEqual(electricity.serviceAddress, {
    city: null,
    provinceState: null,
    postalCode: null,
    country: null,
  });

  const gas = toUtilityBillExtraction(bill("Enbridge Gas", { value: 61, unit: "m³" }));
  assert.deepEqual(gas.naturalGas, { usageM3: 61, cost: 123.45 });

  const water = toUtilityBillExtraction(bill("Toronto Water", { value: 20, unit: "m³" }));
  assert.equal(water.naturalGas, null);
  assert.ok(water.missingCriticalFields.includes("serviceAddress"));
});
