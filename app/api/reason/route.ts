import { randomUUID } from "node:crypto";

import {
  parseReasoningRequest,
  ReasoningInputError,
  researchWithGemini,
} from "@/lib/reasoning";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    const input = parseReasoningRequest(await request.json());
    const data = await researchWithGemini(input);
    return Response.json({ data, error: null, requestId });
  } catch (error) {
    if (error instanceof ReasoningInputError) {
      return Response.json(
        {
          data: null,
          error: { code: "invalid_request", message: error.message, retryable: false },
          requestId,
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        {
          data: null,
          error: {
            code: "invalid_request",
            message: "Request body must be valid JSON.",
            retryable: false,
          },
          requestId,
        },
        { status: 400 },
      );
    }

    console.error("Reasoning request failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        data: null,
        error: {
          code: "reasoning_unavailable",
          message: "Grounded research is temporarily unavailable.",
          retryable: true,
        },
        requestId,
      },
      { status: 503 },
    );
  }
}
