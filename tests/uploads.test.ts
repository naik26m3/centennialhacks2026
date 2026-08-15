import assert from "node:assert/strict";
import test from "node:test";

import {
  createObjectKey,
  isSha256Base64,
  parseUploadRequest,
  presignedTtlSeconds,
  sha256HexFromBase64,
  uploadMaxBytes,
  usesVercelOidc,
} from "../lib/uploads";

const caseId = "123e4567-e89b-12d3-a456-426614174000";
const valid = {
  caseId,
  filename: "bill.pdf",
  contentType: "application/pdf",
  size: 12,
  sha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
};

test("rejects unsafe upload metadata", () => {
  assert.throws(() => parseUploadRequest({ ...valid, contentType: "text/html" }), /contentType/);
  assert.throws(() => parseUploadRequest({ ...valid, size: 0 }), /size/);
  assert.throws(() => parseUploadRequest({ ...valid, sha256: "not-a-checksum" }), /sha256/);
  assert.throws(() => parseUploadRequest({ ...valid, filename: "bill\u0000.pdf" }), /filename/);
  assert.throws(() => parseUploadRequest({ ...valid, caseId: "../../other-case" }), /caseId/);
});

test("accepts the exact image/pdf allowlist and bounds size", () => {
  assert.equal(parseUploadRequest(valid, 12).size, 12);
  assert.equal(parseUploadRequest({ ...valid, contentType: "image/jpeg" }).contentType, "image/jpeg");
  assert.throws(() => parseUploadRequest({ ...valid, size: 13 }, 12), /size/);
  assert.equal(isSha256Base64(valid.sha256), true);
  assert.equal(isSha256Base64("A".repeat(43) + "=="), false);
  assert.equal(sha256HexFromBase64(valid.sha256).length, 64);
});

test("object keys are case scoped and never contain the filename", () => {
  const key = createObjectKey(caseId, "123e4567-e89b-12d3-a456-426614174001");
  assert.equal(key, `cases/${caseId}/documents/123e4567-e89b-12d3-a456-426614174001`);
  assert.equal(key.includes("bill.pdf"), false);
});

test("Vercel OIDC is used only inside Vercel with a configured role", () => {
  assert.equal(usesVercelOidc("1", "arn:aws:iam::123456789012:role/upload"), true);
  assert.equal(usesVercelOidc(undefined, "arn:aws:iam::123456789012:role/upload"), false);
  assert.equal(usesVercelOidc("1", " "), false);
});

test("upload limits reject unsafe configuration", () => {
  assert.equal(uploadMaxBytes("2048"), 2048);
  assert.equal(uploadMaxBytes("0"), 10 * 1024 * 1024);
  assert.equal(presignedTtlSeconds("300"), 300);
  assert.equal(presignedTtlSeconds("901"), 600);
});
