import { getDatabase } from "@/lib/db";

export const CASE_STATUSES = [
  "created",
  "upload_ready",
  "uploaded",
  "extracting",
  "normalizing",
  "needs_review",
  "evaluating",
  "retrieving_evidence",
  "explaining",
  "ready",
  "action_prepared",
  "approved",
  "failed",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];
export type ExecutionMode = "live" | "hybrid" | "demo";

export type CaseRow = {
  id: string;
  status: CaseStatus;
  execution_mode: ExecutionMode;
  created_at: Date | string;
  updated_at: Date | string;
};

export class CaseInputError extends Error {}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[\x21-\x7e]{1,128}$/;

export function parseCaseId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new CaseInputError("Case id must be a valid UUID.");
  return value;
}

export function parseIdempotencyKey(value: string | null): string | null {
  if (value === null) return null;
  const key = value.trim();
  if (!IDEMPOTENCY_PATTERN.test(key)) {
    throw new CaseInputError("Idempotency-Key must contain 1–128 printable characters.");
  }
  return key;
}

export function executionMode(value = process.env.EXECUTION_MODE): ExecutionMode {
  const mode = value || "live";
  if (mode === "live" || mode === "hybrid" || mode === "demo") return mode;
  throw new CaseInputError("EXECUTION_MODE must be live, hybrid, or demo.");
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapCaseStatus(row: CaseRow) {
  return {
    caseId: row.id,
    status: row.status,
    executionMode: row.execution_mode,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

export function mapCaseStatusError(status: CaseStatus) {
  return status === "failed"
    ? {
        code: "processing_failed",
        message: "Case processing failed. Please retry.",
        retryable: true,
      }
    : null;
}

export async function createCase(
  clerkUserId: string,
  idempotencyKey: string | null,
  mode: ExecutionMode,
): Promise<{ row: CaseRow; created: boolean }> {
  const inserted = await getDatabase()<CaseRow[]>`
    INSERT INTO cases (clerk_user_id, execution_mode, idempotency_key)
    VALUES (${clerkUserId}, ${mode}, ${idempotencyKey})
    ON CONFLICT (clerk_user_id, idempotency_key) DO NOTHING
    RETURNING id, status, execution_mode, created_at, updated_at
  `;
  if (inserted[0]) return { row: inserted[0], created: true };

  if (idempotencyKey) {
    const existing = await getDatabase()<CaseRow[]>`
      SELECT id, status, execution_mode, created_at, updated_at
      FROM cases
      WHERE clerk_user_id = ${clerkUserId}
        AND idempotency_key = ${idempotencyKey}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existing[0]) return { row: existing[0], created: false };
  }

  throw new Error("Case could not be created.");
}

export async function findOwnedCaseStatus(
  clerkUserId: string,
  caseId: string,
): Promise<CaseRow | null> {
  const rows = await getDatabase()<CaseRow[]>`
    SELECT id, status, execution_mode, created_at, updated_at
    FROM cases
    WHERE id = ${caseId}
      AND clerk_user_id = ${clerkUserId}
      AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}
