import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import { CaseInputError, parseCaseId } from "@/lib/cases";
import {
  findOwnedCaseResult,
  mapCaseResult,
  mapCaseResultError,
} from "@/lib/results";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const user = await requireUser(requestId);
  if (user instanceof Response) return user;

  try {
    const { id } = await params;
    const caseId = parseCaseId(id);
    const row = await findOwnedCaseResult(user.userId, caseId);
    if (!row) {
      return Response.json(
        {
          data: null,
          error: { code: "not_found", message: "Case not found.", retryable: false },
          requestId,
        },
        { status: 404 },
      );
    }
    const data = mapCaseResult(row);
    return Response.json({ data, error: mapCaseResultError(data.status), requestId });
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

    console.error("Case result lookup failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        data: null,
        error: {
          code: "case_unavailable",
          message: "Case result is temporarily unavailable.",
          retryable: true,
        },
        requestId,
      },
      { status: 503 },
    );
  }
}
