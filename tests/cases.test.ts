import assert from "node:assert/strict";
import test from "node:test";

import {
  CaseInputError,
  executionMode,
  mapCaseStatus,
  mapCaseStatusError,
  parseCaseId,
  parseIdempotencyKey,
} from "../lib/cases";

test("validates case identifiers and idempotency keys", () => {
  assert.equal(parseCaseId("123e4567-e89b-12d3-a456-426614174000"), "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(parseIdempotencyKey("  upload-1 "), "upload-1");
  assert.equal(parseIdempotencyKey(null), null);
  assert.throws(() => parseCaseId("not-a-uuid"), CaseInputError);
  assert.throws(() => parseIdempotencyKey("has spaces"), CaseInputError);
});

test("maps failed status to a safe retryable error", () => {
  const data = mapCaseStatus({
    id: "123e4567-e89b-12d3-a456-426614174000",
    status: "failed",
    execution_mode: "demo",
    created_at: "2026-08-15T00:00:00.000Z",
    updated_at: "2026-08-15T00:01:00.000Z",
  });
  assert.deepEqual(mapCaseStatusError(data.status), {
    code: "processing_failed",
    message: "Case processing failed. Please retry.",
    retryable: true,
  });
  assert.equal(data.executionMode, "demo");
  assert.equal(executionMode("hybrid"), "hybrid");
  assert.throws(() => executionMode("other"), CaseInputError);
});
