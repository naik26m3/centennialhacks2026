import { createHash, timingSafeEqual } from "node:crypto";

import { getDatabase } from "@/lib/db";
import { maskAccountNumber, type CanonicalBillOcr, type OcrEvidence } from "@/lib/ocr";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_CONFIDENCE = 80;

export type ExtractedFieldInput = {
  fieldName: string;
  value: unknown;
  confidence: number | null;
  pageNumber: number | null;
  boundingBox: OcrEvidence["boundingBox"] | null;
  critical: boolean;
};

export class DocumentInputError extends Error {}

export type DocumentStatus = "upload_ready" | "uploaded" | "extracting" | "extracted" | "needs_review" | "failed";
export type DocumentRow = {
  id: string;
  case_id: string;
  object_key: string;
  content_type: string;
  byte_size: number | string;
  sha256: string;
  status: DocumentStatus;
};
export type FieldRow = {
  id: string;
  field_name: string;
  value: unknown;
  confidence: number | string | null;
  page_number: number | null;
  bounding_box: unknown;
  review_status: string;
  critical: boolean;
};

export async function findOwnedDocument(documentId: string, userId: string): Promise<DocumentRow | null> {
  const rows = await getDatabase()<DocumentRow[]>`
    SELECT d.id, d.case_id, d.object_key, d.content_type, d.byte_size, d.sha256, d.status
    FROM documents d
    JOIN cases c ON c.id = d.case_id
    WHERE d.id = ${documentId} AND c.clerk_user_id = ${userId} AND c.deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findDocumentFields(documentId: string): Promise<FieldRow[]> {
  return getDatabase()<FieldRow[]>`
    SELECT id, field_name, value, confidence, page_number, bounding_box, review_status, critical
    FROM extracted_fields
    WHERE document_id = ${documentId}
    ORDER BY field_name
  `;
}

export function mapDocumentFields(rows: readonly FieldRow[]) {
  return rows.map((row) => ({
    id: row.id,
    fieldName: row.field_name,
    value: row.value,
    confidence: row.confidence === null ? null : Number(row.confidence),
    pageNumber: row.page_number,
    boundingBox: row.bounding_box,
    reviewStatus: row.review_status,
    critical: row.critical,
  }));
}

export function parseDocumentId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new DocumentInputError("Document id must be a valid UUID.");
  return value;
}

function evidenceFor(field: { evidence: OcrEvidence[] }): {
  pageNumber: number | null;
  boundingBox: OcrEvidence["boundingBox"] | null;
} {
  const evidence = field.evidence[0];
  return {
    pageNumber: evidence?.page && evidence.page > 0 ? evidence.page : null,
    boundingBox: evidence?.boundingBox ?? null,
  };
}

function field(
  fieldName: string,
  value: unknown,
  confidence: number | null,
  evidence: { evidence: OcrEvidence[] },
  critical: boolean,
): ExtractedFieldInput | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  const location = evidenceFor(evidence);
  return {
    fieldName,
    value,
    confidence: typeof confidence === "number" && Number.isFinite(confidence)
      ? Math.max(0, Math.min(100, confidence))
      : null,
    pageNumber: location.pageNumber,
    boundingBox: location.boundingBox,
    critical,
  };
}

export function buildExtractedFields(ocr: CanonicalBillOcr): ExtractedFieldInput[] {
  const accountNumber = typeof ocr.accountNumber.value === "string"
    ? maskAccountNumber(ocr.accountNumber.value)
    : ocr.accountNumber.value;
  return [
    field("provider", ocr.provider.value, ocr.provider.confidence, ocr.provider, false),
    field("billing_period", ocr.billingPeriod.value, ocr.billingPeriod.confidence, ocr.billingPeriod, true),
    field("total", ocr.total.value, ocr.total.confidence, ocr.total, true),
    field("usage", ocr.usage.value, ocr.usage.confidence, ocr.usage, false),
    field("account_number", accountNumber, ocr.accountNumber.confidence, ocr.accountNumber, true),
  ].filter((entry): entry is ExtractedFieldInput => entry !== null);
}

export function documentNeedsReview(fields: readonly ExtractedFieldInput[]): boolean {
  const criticalFields = ["billing_period", "total", "account_number"];
  return criticalFields.some((fieldName) => {
    const field = fields.find((entry) => entry.fieldName === fieldName);
    return !field || field.confidence === null || field.confidence < REVIEW_CONFIDENCE;
  });
}

export function verifyObjectBytes(
  bytes: Uint8Array,
  expectedByteSize: number | string,
  expectedSha256: string,
): Uint8Array {
  const expectedSize = typeof expectedByteSize === "string" ? Number(expectedByteSize) : expectedByteSize;
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || bytes.byteLength !== expectedSize) {
    throw new DocumentInputError("Stored document size verification failed.");
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  const expected = expectedSha256.toLowerCase();
  const matches = /^[a-f0-9]{64}$/.test(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  if (!matches) throw new DocumentInputError("Stored document checksum verification failed.");
  return bytes;
}

export async function readObjectBody(body: unknown, maxBytes = 10 * 1024 * 1024): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return new Uint8Array(body);
  if (body && typeof body === "object" && "transformToByteArray" in body) {
    const transform = (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray;
    if (transform) return new Uint8Array(await transform.call(body));
  }
  if (!body || typeof body !== "object" || !(Symbol.asyncIterator in body)) {
    throw new DocumentInputError("Stored document body is unavailable.");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);
    length += bytes.byteLength;
    if (length > maxBytes) throw new DocumentInputError("Stored document exceeds its recorded size.");
    chunks.push(bytes);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
