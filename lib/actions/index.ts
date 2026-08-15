import { randomUUID } from "node:crypto";

import { getDatabase, type Database } from "@/lib/db";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[\x21-\x7e]{1,128}$/;
const ROUTE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export class ActionInputError extends Error {}

export class ActionNotFoundError extends Error {}

export class ActionConflictError extends Error {
  constructor(
    readonly code: "official_route_unverified" | "idempotency_conflict" | "action_not_approvable",
    message: string,
  ) {
    super(message);
  }
}

export type ActionRoute = {
  id: string;
  routeKey: string;
  type: string;
  destination: string | null;
  instructions: Record<string, unknown>;
  verified: boolean;
  verifiedAt: string | null;
  staleAfter: string | null;
};

export type PreparedAction = {
  id: string;
  opportunityId: string;
  caseId: string;
  status: "prepared" | "approved" | "cancelled" | "expired";
  actionRoute: ActionRoute;
  requiresApproval: true;
  createdAt: string;
  approvedAt: string | null;
};

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
type TransactionalDatabase = Sql & {
  begin: <T>(callback: (sql: Sql) => Promise<T>) => Promise<T>;
};

type ActionRow = {
  id: string;
  opportunity_id: string;
  case_id: string;
  status: PreparedAction["status"];
  evaluation_status: string;
  route_id: string;
  route_key: string;
  route_type: string;
  destination: string | null;
  instructions: unknown;
  verified: boolean;
  verified_at: Date | string | null;
  stale_after: Date | string | null;
  created_at: Date | string;
  approved_at: Date | string | null;
};

type EvaluationRow = {
  id: string;
  case_id: string;
  program_version_id: string;
  status: string;
};

function database(value?: Database): TransactionalDatabase {
  return (value ?? getDatabase()) as unknown as TransactionalDatabase;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function instructions(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseActionId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new ActionInputError("Action id must be a valid UUID.");
  return value;
}

export function parseOpportunityId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new ActionInputError("Opportunity id must be a valid UUID.");
  return value;
}

export function parseActionIdempotencyKey(value: string | null): string {
  if (value === null) throw new ActionInputError("Idempotency-Key is required.");
  const key = value.trim();
  if (!IDEMPOTENCY_PATTERN.test(key)) {
    throw new ActionInputError("Idempotency-Key must contain 1–128 printable characters.");
  }
  return key;
}

export function parseRouteKey(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !ROUTE_KEY_PATTERN.test(value)) {
    throw new ActionInputError("routeKey must be a lowercase route identifier.");
  }
  return value;
}

export function mapPreparedAction(row: ActionRow): PreparedAction {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    caseId: row.case_id,
    status: row.status,
    actionRoute: {
      id: row.route_id,
      routeKey: row.route_key,
      type: row.route_type,
      destination: row.destination,
      instructions: instructions(row.instructions),
      verified: row.verified,
      verifiedAt: iso(row.verified_at),
      staleAfter: iso(row.stale_after),
    },
    requiresApproval: true,
    createdAt: iso(row.created_at) as string,
    approvedAt: iso(row.approved_at),
  };
}

async function findEvaluation(
  sql: Sql,
  userId: string,
  opportunityId: string,
): Promise<EvaluationRow | null> {
  const rows = await sql`
    SELECT e.id, e.case_id, e.program_version_id, e.status
    FROM case_program_evaluations e
    JOIN cases c ON c.id = e.case_id
    WHERE e.id = ${opportunityId}
      AND c.clerk_user_id = ${userId}
      AND c.deleted_at IS NULL
    LIMIT 1
  `;
  return (rows[0] as EvaluationRow | undefined) ?? null;
}

async function findActionByKey(sql: Sql, caseId: string, key: string): Promise<ActionRow | null> {
  const rows = await sql`
    SELECT pa.id, pa.evaluation_id AS opportunity_id, pa.case_id, pa.status,
           e.status AS evaluation_status,
           ar.id AS route_id, ar.route_key, ar.route_type, ar.destination,
           ar.instructions, ar.verified, ar.verified_at, ar.stale_after,
           pa.created_at, pa.approved_at
    FROM prepared_actions pa
    JOIN action_routes ar ON ar.id = pa.action_route_id
    JOIN case_program_evaluations e ON e.id = pa.evaluation_id AND e.case_id = pa.case_id
    WHERE pa.case_id = ${caseId} AND pa.idempotency_key = ${key}
    LIMIT 1
  `;
  return (rows[0] as ActionRow | undefined) ?? null;
}

async function findActionById(sql: Sql, userId: string, actionId: string): Promise<ActionRow | null> {
  const rows = await sql`
    SELECT pa.id, pa.evaluation_id AS opportunity_id, pa.case_id, pa.status,
           e.status AS evaluation_status,
           ar.id AS route_id, ar.route_key, ar.route_type, ar.destination,
           ar.instructions, ar.verified, ar.verified_at, ar.stale_after,
           pa.created_at, pa.approved_at
    FROM prepared_actions pa
    JOIN action_routes ar ON ar.id = pa.action_route_id
    JOIN case_program_evaluations e ON e.id = pa.evaluation_id AND e.case_id = pa.case_id
    JOIN cases c ON c.id = pa.case_id
    WHERE pa.id = ${actionId}
      AND c.clerk_user_id = ${userId}
      AND c.deleted_at IS NULL
    FOR UPDATE OF pa
  `;
  return (rows[0] as ActionRow | undefined) ?? null;
}

async function findRoute(
  sql: Sql,
  programVersionId: string,
  routeKey: string | null,
): Promise<ActionRoute | null> {
  const rows = routeKey === null
    ? await sql`
      SELECT id, route_key, route_type, destination, instructions, verified, verified_at, stale_after
      FROM action_routes
      WHERE program_version_id = ${programVersionId}
        AND verified = true
        AND (stale_after IS NULL OR stale_after > now())
      ORDER BY CASE WHEN route_type = 'manual_review' THEN 1 ELSE 0 END, route_key
      LIMIT 1
    `
    : await sql`
      SELECT id, route_key, route_type, destination, instructions, verified, verified_at, stale_after
      FROM action_routes
      WHERE program_version_id = ${programVersionId}
        AND route_key = ${routeKey}
        AND verified = true
        AND (stale_after IS NULL OR stale_after > now())
      LIMIT 1
    `;
  const row = rows[0] as {
    id: string;
    route_key: string;
    route_type: string;
    destination: string | null;
    instructions: unknown;
    verified: boolean;
    verified_at: Date | string | null;
    stale_after: Date | string | null;
  } | undefined;
  if (!row || (row.route_type !== "manual_review" && !row.destination?.trim())) return null;
  return {
    id: row.id,
    routeKey: row.route_key,
    type: row.route_type,
    destination: row.destination,
    instructions: instructions(row.instructions),
    verified: row.verified,
    verifiedAt: iso(row.verified_at),
    staleAfter: iso(row.stale_after),
  };
}

async function readExistingAction(
  sql: Sql,
  evaluation: EvaluationRow,
  key: string,
): Promise<PreparedAction | null> {
  const existing = await findActionByKey(sql, evaluation.case_id, key);
  if (!existing) return null;
  if (existing.opportunity_id !== evaluation.id) {
    throw new ActionConflictError(
      "idempotency_conflict",
      "That idempotency key is already associated with another action.",
    );
  }
  return mapPreparedAction(existing);
}

export async function prepareAction(
  userId: string,
  opportunityId: string,
  idempotencyKey: string,
  routeKey: string | null = null,
  db?: Database,
): Promise<{ action: PreparedAction; created: boolean }> {
  const dbClient = database(db);
  return dbClient.begin(async (sql) => {
    const evaluation = await findEvaluation(sql, userId, opportunityId);
    if (!evaluation) throw new ActionNotFoundError("Opportunity not found.");
    if (evaluation.status !== "eligible") {
      throw new ActionConflictError("action_not_approvable", "This action is no longer available for approval.");
    }

    const existing = await readExistingAction(sql, evaluation, idempotencyKey);
    if (existing) return { action: existing, created: false };

    const route = await findRoute(sql, evaluation.program_version_id, routeKey);
    if (!route) {
      throw new ActionConflictError(
        "official_route_unverified",
        "An official action route requires manual review.",
      );
    }

    const payload = JSON.stringify({ routeKey: route.routeKey, routeType: route.type });
    const inserted = await sql`
      INSERT INTO prepared_actions
        (case_id, evaluation_id, action_route_id, status, payload, idempotency_key)
      VALUES
        (${evaluation.case_id}, ${evaluation.id}, ${route.id}, 'prepared', ${payload}::jsonb, ${idempotencyKey})
      ON CONFLICT (case_id, idempotency_key) DO NOTHING
      RETURNING id
    `;
    if (!inserted[0]) {
      const retry = await readExistingAction(sql, evaluation, idempotencyKey);
      if (retry) return { action: retry, created: false };
      throw new ActionConflictError(
        "idempotency_conflict",
        "That idempotency key is already associated with another action.",
      );
    }

    await sql`
      UPDATE cases
      SET status = 'action_prepared'
      WHERE id = ${evaluation.case_id}
        AND clerk_user_id = ${userId}
        AND deleted_at IS NULL
        AND status <> 'approved'
    `;
    await sql`
      INSERT INTO audit_events
        (case_id, clerk_user_id, event_type, entity_type, entity_id, payload, idempotency_key)
      VALUES
        (${evaluation.case_id}, ${userId}, 'action.prepared', 'prepared_action', ${String((inserted[0] as { id: string }).id)},
         ${JSON.stringify({ opportunityId: evaluation.id, routeKey: route.routeKey })}::jsonb, ${idempotencyKey})
      ON CONFLICT (case_id, idempotency_key) DO NOTHING
    `;
    const action = await findActionByKey(sql, evaluation.case_id, idempotencyKey);
    if (!action) throw new Error("Prepared action could not be loaded.");
    return { action: mapPreparedAction(action), created: true };
  });
}

export async function approveAction(
  userId: string,
  actionId: string,
  idempotencyKey: string,
  db?: Database,
): Promise<{ action: PreparedAction; changed: boolean }> {
  const dbClient = database(db);
  return dbClient.begin(async (sql) => {
    const action = await findActionById(sql, userId, actionId);
    if (!action) throw new ActionNotFoundError("Action not found.");
    if (action.evaluation_status !== "eligible") {
      throw new ActionConflictError("action_not_approvable", "This action is no longer available for approval.");
    }

    const priorEvents = await sql`
      SELECT event_type, entity_id
      FROM audit_events
      WHERE case_id = ${action.case_id} AND idempotency_key = ${idempotencyKey}
      LIMIT 1
    `;
    const prior = priorEvents[0] as { event_type: string; entity_id: string | null } | undefined;
    if (prior && (prior.entity_id !== action.id || prior.event_type !== "action.approved")) {
      throw new ActionConflictError(
        "idempotency_conflict",
        "That idempotency key is already associated with another action.",
      );
    }
    if (prior || action.status === "approved") {
      return { action: mapPreparedAction(action), changed: false };
    }
    if (action.status !== "prepared") {
      throw new ActionConflictError(
        "action_not_approvable",
        "This action is no longer available for approval.",
      );
    }

    const updatedRows = await sql`
      UPDATE prepared_actions
      SET status = 'approved', approved_at = now(), approved_by_clerk_user_id = ${userId}
      WHERE id = ${action.id} AND status = 'prepared'
      RETURNING approved_at
    `;
    if (!updatedRows[0]) throw new ActionConflictError("action_not_approvable", "This action is no longer available for approval.");
    const approvedAt = (updatedRows[0] as { approved_at: Date | string }).approved_at;

    await sql`
      UPDATE cases
      SET status = 'approved'
      WHERE id = ${action.case_id} AND clerk_user_id = ${userId} AND deleted_at IS NULL
    `;
    await sql`
      INSERT INTO audit_events
        (case_id, clerk_user_id, event_type, entity_type, entity_id, payload, idempotency_key)
      VALUES
        (${action.case_id}, ${userId}, 'action.approved', 'prepared_action', ${action.id},
         ${JSON.stringify({ opportunityId: action.opportunity_id })}::jsonb, ${idempotencyKey})
    `;
    return {
      action: mapPreparedAction({ ...action, status: "approved", approved_at: approvedAt }),
      changed: true,
    };
  });
}

export function manualReviewData(opportunityId: string) {
  return {
    opportunityId,
    status: "manual_review" as const,
    actionRoute: null,
    requiresApproval: true as const,
    manualReview: true as const,
  };
}

export function requestId(): string {
  return randomUUID();
}
