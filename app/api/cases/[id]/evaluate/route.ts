import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import {
  evaluateCase,
  EvaluationInputError,
  EvaluationNotFoundError,
  parseEvaluationCaseId,
} from "@/lib/evaluation";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const user = await requireUser(requestId);
  if (user instanceof Response) return user;

  try {
    const caseId = parseEvaluationCaseId((await params).id);
    const data = await evaluateCase(user.userId, caseId);
    return Response.json({ data, error: null, requestId });
  } catch (error) {
    if (error instanceof EvaluationInputError) {
      return Response.json(
        {
          data: null,
          error: { code: "invalid_request", message: error.message, retryable: false },
          requestId,
        },
        { status: 400 },
      );
    }
    if (error instanceof EvaluationNotFoundError) {
      return Response.json(
        {
          data: null,
          error: { code: "not_found", message: "Case not found.", retryable: false },
          requestId,
        },
        { status: 404 },
      );
    }
    console.error("Case evaluation failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        data: null,
        error: {
          code: "evaluation_unavailable",
          message: "Case evaluation is temporarily unavailable.",
          retryable: true,
        },
        requestId,
      },
      { status: 503 },
    );
  }
}
