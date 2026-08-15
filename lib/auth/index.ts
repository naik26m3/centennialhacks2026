import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";

export type AuthenticatedUser = { userId: string };
export type RequireUserResult = AuthenticatedUser | Response;

/** Authenticate a Route Handler request without exposing Clerk internals. */
export async function requireUser(requestId = randomUUID()): Promise<RequireUserResult> {
  try {
    const { userId } = await auth();
    if (userId) return { userId };
  } catch (error) {
    console.error("Authentication lookup failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        data: null,
        error: {
          code: "authentication_unavailable",
          message: "Authentication is temporarily unavailable.",
          retryable: true,
        },
        requestId,
      },
      { status: 503 },
    );
  }

  return Response.json(
    {
      data: null,
      error: {
        code: "unauthenticated",
        message: "Authentication is required.",
        retryable: false,
      },
      requestId,
    },
    { status: 401 },
  );
}
