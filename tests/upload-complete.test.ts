import assert from "node:assert/strict";
import test from "node:test";

import {
  isCompletionIdempotentStatus,
  verifyHeadObject,
} from "../app/api/uploads/[documentId]/complete/route";

const document = {
  byte_size: 12,
  content_type: "application/pdf",
  sha256: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
};
const checksum = Buffer.from(document.sha256, "hex").toString("base64");

test("accepts mocked S3 HEAD metadata only when size, type, and checksum match", () => {
  assert.doesNotThrow(() => verifyHeadObject(document, {
    ContentLength: 12,
    ContentType: "application/pdf",
    ChecksumSHA256: checksum,
  }));
  assert.throws(() => verifyHeadObject(document, {
    ContentLength: 11,
    ContentType: "application/pdf",
    ChecksumSHA256: checksum,
  }), /metadata/);
  assert.throws(() => verifyHeadObject(document, {
    ContentLength: 12,
    ContentType: "image/jpeg",
    ChecksumSHA256: checksum,
  }), /metadata/);
  assert.throws(() => verifyHeadObject(document, {
    ContentLength: 12,
    ContentType: "application/pdf",
    ChecksumSHA256: "wrong",
  }), /verification/);
});

test("completion is idempotent for every post-upload processing status", () => {
  for (const status of ["uploaded", "extracting", "extracted", "needs_review"] as const) {
    assert.equal(isCompletionIdempotentStatus(status), true);
  }
  assert.equal(isCompletionIdempotentStatus("upload_ready"), false);
  assert.equal(isCompletionIdempotentStatus("failed"), false);
});
