import { randomUUID } from "node:crypto";

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export type UploadContentType = (typeof ALLOWED_UPLOAD_TYPES)[number];

export type UploadRequest = {
  caseId: string;
  filename: string;
  contentType: UploadContentType;
  size: number;
  sha256: string;
  idempotencyKey?: string;
};

export class UploadValidationError extends Error {
  readonly code = "invalid_request";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_BASE64 = /^[A-Za-z0-9+/]{43}=$/;
const MAX_FILENAME_LENGTH = 255;
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const DEFAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function uploadMaxBytes(value = process.env.UPLOAD_MAX_BYTES): number {
  const parsed = Number(value ?? DEFAULT_UPLOAD_MAX_BYTES);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_UPLOAD_MAX_BYTES;
}

export function isSha256Base64(value: unknown): value is string {
  return typeof value === "string" && SHA256_BASE64.test(value) && Buffer.from(value, "base64").length === 32;
}

export function sha256HexFromBase64(value: string): string {
  if (!isSha256Base64(value)) throw new UploadValidationError("Invalid SHA-256 checksum.");
  return Buffer.from(value, "base64").toString("hex");
}

export function usesVercelOidc(
  vercel = process.env.VERCEL,
  roleArn = process.env.AWS_ROLE_ARN,
): boolean {
  return vercel === "1" && Boolean(roleArn?.trim());
}

export function parseUploadRequest(input: unknown, maxBytes = uploadMaxBytes()): UploadRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new UploadValidationError("Request body must be a JSON object.");
  }

  const body = input as Record<string, unknown>;
  const { caseId, filename, contentType, size, sha256 } = body;
  const idempotencyKey = body.idempotencyKey;

  if (typeof caseId !== "string" || !UUID.test(caseId)) {
    throw new UploadValidationError("caseId must be a valid UUID.");
  }
  if (
    typeof filename !== "string" ||
    !filename.trim() ||
    filename.length > MAX_FILENAME_LENGTH ||
    /[\\/]/.test(filename) ||
    /[\u0000-\u001f\u007f]/.test(filename)
  ) {
    throw new UploadValidationError("filename must be a valid file name.");
  }
  if (
    typeof contentType !== "string" ||
    !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(contentType)
  ) {
    throw new UploadValidationError("contentType must be image/jpeg, image/png, or application/pdf.");
  }
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
    throw new UploadValidationError(`size must be a positive integer no larger than ${maxBytes} bytes.`);
  }
  if (!isSha256Base64(sha256)) {
    throw new UploadValidationError("sha256 must be a base64-encoded SHA-256 checksum.");
  }
  if (idempotencyKey !== undefined &&
      (typeof idempotencyKey !== "string" ||
       !idempotencyKey.trim() ||
       idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
       /[\u0000-\u001f\u007f]/.test(idempotencyKey))) {
    throw new UploadValidationError("idempotencyKey must be a valid value.");
  }

  return {
    caseId,
    filename: filename.trim(),
    contentType: contentType as UploadContentType,
    size,
    sha256,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey: idempotencyKey.trim() }),
  };
}

/** The original name is metadata only; object keys are always opaque UUIDs. */
export function createObjectKey(caseId: string, documentToken = randomUUID()): string {
  if (!UUID.test(caseId) || !UUID.test(documentToken)) {
    throw new UploadValidationError("Cannot create an upload key for an invalid identifier.");
  }
  return `cases/${caseId}/documents/${documentToken}`;
}

export function presignedTtlSeconds(value = process.env.PRESIGNED_UPLOAD_TTL_SECONDS): number {
  const parsed = Number(value ?? 600);
  // A URL longer than 15 minutes is not short-lived enough for this trust boundary.
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 900 ? parsed : 600;
}

export function requestId(): ReturnType<typeof randomUUID> {
  return randomUUID();
}
