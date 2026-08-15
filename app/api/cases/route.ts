import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import {
  CaseInputError,
  createCase,
  executionMode,
  mapCaseStatus,
  mapCaseStatusError,
  parseIdempotencyKey,
} from "@/lib/cases";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const user = await requireUser(requestId);
  if (user instanceof Response) return user;

  try {
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const result = await createCase(user.userId, idempotencyKey, executionMode());
    return Response.json(
      { data: mapCaseStatus(result.row), error: mapCaseStatusError(result.row.status), requestId },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof CaseInputError) {
      return Response.json(
        {
          data: null,
          error: { code: "invalid_request", message: error.message, retryable: false },
          requestId,
        },
        { status: 400 },
      );
    }

    console.error("Case creation failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        data: null,
        error: {
          code: "case_unavailable",
          message: "Cases are temporarily unavailable.",
          retryable: true,
        },
        requestId,
      },
      { status: 503 },
    );
  }
}
