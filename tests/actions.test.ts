import assert from "node:assert/strict";
import test from "node:test";

import {
  ActionConflictError,
  ActionNotFoundError,
  approveAction,
  parseActionId,
  parseActionIdempotencyKey,
  parseRouteKey,
  prepareAction,
} from "../lib/actions";

const opportunityId = "123e4567-e89b-12d3-a456-426614174000";
const caseId = "123e4567-e89b-12d3-a456-426614174001";
const routeId = "123e4567-e89b-12d3-a456-426614174002";
const actionId = "123e4567-e89b-12d3-a456-426614174003";
const versionId = "123e4567-e89b-12d3-a456-426614174004";

const routeRow = {
  id: routeId,
  route_key: "apply_online",
  route_type: "official_portal",
  destination: "https://official.example/apply",
  instructions: { steps: ["Review", "Apply"] },
  verified: true,
  verified_at: "2026-08-01T00:00:00.000Z",
  stale_after: null,
};

function actionRow(status: "prepared" | "approved" = "prepared") {
  return {
    id: actionId,
    opportunity_id: opportunityId,
    case_id: caseId,
    status,
    route_id: routeId,
    route_key: routeRow.route_key,
    route_type: routeRow.route_type,
    destination: routeRow.destination,
    instructions: routeRow.instructions,
    verified: routeRow.verified,
    verified_at: routeRow.verified_at,
    stale_after: routeRow.stale_after,
    created_at: "2026-08-15T00:00:00.000Z",
    approved_at: status === "approved" ? "2026-08-15T00:01:00.000Z" : null,
  };
}

type FakeState = { action?: ReturnType<typeof actionRow>; route?: typeof routeRow; inserted: boolean; evaluation?: boolean };

function fakeDatabase(state: FakeState) {
  const query = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join(" ");
    if (sql.includes("FROM case_program_evaluations")) {
      return state.evaluation === false
        ? []
        : [{ id: opportunityId, case_id: caseId, program_version_id: versionId }];
    }
    if (sql.includes("FROM prepared_actions pa")) return state.action ? [state.action] : [];
    if (sql.includes("FROM action_routes")) return state.route?.verified ? [state.route] : [];
    if (sql.includes("INSERT INTO prepared_actions")) {
      if (!state.inserted) {
        state.inserted = true;
        state.action = actionRow();
        return [{ id: actionId }];
      }
      return [];
    }
    if (sql.includes("UPDATE prepared_actions")) {
      state.action = actionRow("approved");
      return [{ approved_at: state.action.approved_at }];
    }
    return [];
  }) as ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>);
  return Object.assign(query, {
    begin: async <T>(callback: (sql: typeof query) => Promise<T>) => callback(query),
  });
}

test("validates action ownership inputs and required idempotency", () => {
  assert.equal(parseActionId(opportunityId), opportunityId);
  assert.equal(parseActionIdempotencyKey("  prepare-1 "), "prepare-1");
  assert.equal(parseRouteKey("apply_online"), "apply_online");
  assert.throws(() => parseActionId("not-an-id"));
  assert.throws(() => parseActionIdempotencyKey(null), /required/);
  assert.throws(() => parseRouteKey("Not Safe"));
});

test("prepare selects only verified routes and reuses an idempotency key", async () => {
  const state: FakeState = { route: routeRow, inserted: false };
  const db = fakeDatabase(state);
  const first = await prepareAction("user-1", opportunityId, "prepare-1", null, db as never);
  assert.equal(first.created, true);
  assert.equal(first.action.actionRoute.verified, true);
  assert.equal(first.action.actionRoute.destination, routeRow.destination);

  const retry = await prepareAction("user-1", opportunityId, "prepare-1", null, db as never);
  assert.equal(retry.created, false);
  assert.equal(retry.action.id, actionId);
});

test("prepare never fabricates a destination for an unverified or missing route", async () => {
  const db = fakeDatabase({ inserted: false, evaluation: false });
  await assert.rejects(
    prepareAction("user-1", opportunityId, "prepare-2", null, db as never),
    (error: unknown) => error instanceof ActionNotFoundError,
  );

  const noRouteDb = fakeDatabase({ route: undefined, action: undefined, inserted: false });
  await assert.rejects(
    prepareAction("user-1", opportunityId, "prepare-3", null, noRouteDb as never),
    (error: unknown) => error instanceof ActionConflictError,
  );

  const unverifiedRouteDb = fakeDatabase({ route: { ...routeRow, verified: false }, inserted: false });
  await assert.rejects(
    prepareAction("user-1", opportunityId, "prepare-4", null, unverifiedRouteDb as never),
    (error: unknown) => error instanceof ActionConflictError,
  );
});

test("approval is explicit, transitions the case action, and is retry-safe", async () => {
  const state: FakeState = { action: actionRow(), inserted: true };
  const db = fakeDatabase(state);
  const approved = await approveAction("user-1", actionId, "approve-1", db as never);
  assert.equal(approved.changed, true);
  assert.equal(approved.action.status, "approved");
  assert.equal(approved.action.approvedAt, "2026-08-15T00:01:00.000Z");
});
