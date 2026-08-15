import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import {
  ActionConflictError,
  ActionInputError,
  ActionNotFoundError,
  approveAction,
  parseActionId,
  parseActionIdempotencyKey,
} from "@/lib/actions";

export const runtime = "nodejs";

function errorResponse(
  requestIdValue: string,
  code: string,
  message: string,
  status: number,
  retryable = false,
) {
  return Response.json(
    { data: null, error: { code, message, retryable }, requestId: requestIdValue },
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
    const actionId = parseActionId((await params).id);
    const idempotencyKey = parseActionIdempotencyKey(request.headers.get("idempotency-key"));
    const result = await approveAction(user.userId, actionId, idempotencyKey);
    return Response.json({ data: result.action, error: null, requestId: id });
  } catch (error) {
    if (error instanceof ActionInputError) return errorResponse(id, "invalid_request", error.message, 400);
    if (error instanceof ActionNotFoundError) return errorResponse(id, "not_found", error.message, 404);
    if (error instanceof ActionConflictError) return errorResponse(id, error.code, error.message, 409);
    console.error("Action approval failed", {
      requestId: id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(id, "action_unavailable", "Actions are temporarily unavailable.", 503, true);
  }
}
