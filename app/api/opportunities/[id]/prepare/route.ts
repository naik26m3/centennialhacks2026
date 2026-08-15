import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import {
  ActionConflictError,
  ActionInputError,
  ActionNotFoundError,
  manualReviewData,
  parseActionIdempotencyKey,
  parseOpportunityId,
  parseRouteKey,
  prepareAction,
} from "@/lib/actions";

export const runtime = "nodejs";

function errorResponse(
  requestIdValue: string,
  code: string,
  message: string,
  status: number,
  retryable = false,
  data: unknown = null,
) {
  return Response.json(
    { data, error: { code, message, retryable }, requestId: requestIdValue },
    { status },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = randomUUID();
  const user = await requireUser(id);
  if (user instanceof Response) return user;

  try {
    const opportunityId = parseOpportunityId((await params).id);
    const idempotencyKey = parseActionIdempotencyKey(request.headers.get("idempotency-key"));
    let body: unknown = {};
    const rawBody = await request.text();
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        throw new ActionInputError("Request body must be valid JSON.");
      }
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new ActionInputError("Request body must be a JSON object.");
    }
    const bodyRecord = body as Record<string, unknown>;
    if (bodyRecord.idempotencyKey !== undefined && bodyRecord.idempotencyKey !== idempotencyKey) {
      throw new ActionInputError("Idempotency-Key must match body.idempotencyKey.");
    }
    const routeKey = parseRouteKey(bodyRecord.routeKey);
    const result = await prepareAction(user.userId, opportunityId, idempotencyKey, routeKey);
    return Response.json(
      { data: result.action, error: null, requestId: id },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof ActionInputError) return errorResponse(id, "invalid_request", error.message, 400);
    if (error instanceof ActionNotFoundError) return errorResponse(id, "not_found", error.message, 404);
    if (error instanceof ActionConflictError) {
      return errorResponse(
        id,
        error.code,
        error.message,
        409,
        false,
        error.code === "official_route_unverified" ? manualReviewData((await params).id) : null,
      );
    }
    console.error("Action preparation failed", {
      requestId: id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(id, "action_unavailable", "Actions are temporarily unavailable.", 503, true);
  }
}
