import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildExtractedFields,
  documentNeedsReview,
  parseDocumentId,
  verifyObjectBytes,
} from "../lib/documents";

const ocr = {
  provider: {
    value: "Toronto Hydro",
    confidence: 96,
    evidence: [{ page: 1, text: "Toronto Hydro", confidence: 96, source: "textract" as const }],
  },
  billingPeriod: { value: { start: "2026-04-13", end: "2026-05-12" }, confidence: 94, evidence: [] },
  total: { value: 81.23, confidence: 72, evidence: [{ page: 1, text: "$81.23", confidence: 72 }] },
  usage: { value: { value: 482, unit: "kWh" }, confidence: 91, evidence: [] },
  accountNumber: {
    value: "••••1234",
    confidence: 90,
    evidence: [{ page: 1, text: "••••1234", confidence: 90 }],
  },
};

test("document helpers validate UUIDs and persist only non-empty canonical fields", () => {
  assert.equal(parseDocumentId("123e4567-e89b-12d3-a456-426614174000"), "123e4567-e89b-12d3-a456-426614174000");
  assert.throws(() => parseDocumentId("not-a-uuid"), /valid UUID/);

  const fields = buildExtractedFields(ocr);
  assert.deepEqual(fields.map((field) => field.fieldName), [
    "provider",
    "billing_period",
    "total",
    "usage",
    "account_number",
  ]);
  assert.equal(fields.find((field) => field.fieldName === "account_number")?.value, "••••1234");
  assert.equal(documentNeedsReview(fields), true);
});

test("object verification checks both byte length and sha256", () => {
  const bytes = new TextEncoder().encode("bill");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual(verifyObjectBytes(bytes, bytes.byteLength, sha256), bytes);
  assert.throws(() => verifyObjectBytes(bytes, bytes.byteLength + 1, sha256), /size/);
  assert.throws(() => verifyObjectBytes(bytes, bytes.byteLength, "0".repeat(64)), /checksum/);
});
