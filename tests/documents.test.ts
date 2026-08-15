import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildExtractedFields,
  documentNeedsReview,
  FieldReviewInputError,
  parseFieldReviewInput,
  parseDocumentId,
  updateDocumentField,
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

test("field review input accepts confirm/correct and rejects unsafe requests", () => {
  const confirmed = parseFieldReviewInput({ fieldId: "123e4567-e89b-12d3-a456-426614174001", action: "confirm" });
  assert.deepEqual(confirmed, {
    fieldId: "123e4567-e89b-12d3-a456-426614174001",
    reviewStatus: "confirmed",
  });
  assert.deepEqual(parseFieldReviewInput({ fieldName: "total", reviewStatus: "corrected", value: 42.5 }), {
    fieldName: "total",
    reviewStatus: "corrected",
    value: 42.5,
  });
  assert.throws(() => parseFieldReviewInput({ fieldName: "new_field", reviewStatus: "corrected", value: "" }), FieldReviewInputError);
  assert.throws(() => parseFieldReviewInput({ fieldName: "total", reviewStatus: "corrected" }), FieldReviewInputError);
  assert.throws(() => parseFieldReviewInput({ fieldName: "total", reviewStatus: "confirmed", value: 42 }), FieldReviewInputError);
  assert.throws(() => parseFieldReviewInput({ fieldName: "total", reviewStatus: "confirmed", fieldId: "123e4567-e89b-12d3-a456-426614174001" }), FieldReviewInputError);
});

test("field updates use one ownership-constrained UPDATE and never insert", async () => {
  const statements: string[] = [];
  const db = (async (strings: TemplateStringsArray) => {
    const statement = strings.join(" ");
    statements.push(statement);
    return [{
      id: "123e4567-e89b-12d3-a456-426614174001",
      field_name: "total",
      value: 42.5,
      confidence: 72,
      page_number: 1,
      bounding_box: null,
      review_status: "corrected",
      critical: true,
    }];
  }) as never;
  const updated = await updateDocumentField(
    "123e4567-e89b-12d3-a456-426614174000",
    "user-1",
    { fieldName: "total", reviewStatus: "corrected", value: 42.5 },
    db,
  );
  assert.equal(updated?.review_status, "corrected");
  assert.equal(statements.length, 1);
  assert.match(statements[0]!, /UPDATE extracted_fields/);
  assert.doesNotMatch(statements[0]!, /INSERT INTO/);
  assert.match(statements[0]!, /c\.clerk_user_id/);
  assert.match(statements[0]!, /f\.document_id = d\.id/);

  const emptyDb = (async () => []) as never;
  assert.equal(await updateDocumentField(
    "123e4567-e89b-12d3-a456-426614174000",
    "user-1",
    { fieldName: "does_not_exist", reviewStatus: "confirmed" },
    emptyDb,
  ), null);
});
