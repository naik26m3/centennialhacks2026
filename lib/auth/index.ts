// Authentication has been removed for the hackathon build.
//
// Build brief §67: "Do not block the wow moment with signup. Demo path must
// work without auth." Clerk previously sat in front of every /api/* route via
// proxy.ts and redirected unauthenticated callers to a hosted sign-in page,
// which blocked the upload flow and broke every non-browser client.
//
// This keeps the `requireUser` contract that all eleven route handlers already
// depend on, so nothing downstream needed to change — it simply always resolves
// to the same local user instead of consulting an identity provider.
//
// To restore real auth: reinstate proxy.ts with clerkMiddleware, put back the
// @clerk/nextjs dependency, and have requireUser call `auth()` again. Every
// caller here is unchanged, so that swap is confined to this file plus the
// middleware. Case ownership is keyed on the returned userId, so restoring auth
// will scope existing demo rows to DEMO_USER_ID rather than a real account.

import { randomUUID } from "node:crypto";

export type AuthenticatedUser = { userId: string };
export type RequireUserResult = AuthenticatedUser | Response;

/**
 * Stable so that cases created across requests belong to one owner and the
 * status/result lookups keyed on user id keep working.
 */
export const DEMO_USER_ID = "demo-user";

/**
 * Previously authenticated the request via Clerk. Now resolves unconditionally.
 * Kept async and returning `RequireUserResult` so callers that do
 * `if (user instanceof Response) return user;` continue to compile and read
 * correctly.
 */
export async function requireUser(_requestId = randomUUID()): Promise<RequireUserResult> {
  return { userId: DEMO_USER_ID };
}
