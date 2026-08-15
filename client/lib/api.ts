// The client's link to the Greenlight backend (the root Next.js app).
//
// Every route handler answers with the same envelope:
//   { data: T | null, error: { code, message, retryable } | null, requestId }
// so this file unwraps it once and hands the rest of the app a discriminated
// result instead of a raw Response.
//
// Auth status (verified against lib/auth/index.ts): only `/api/health` is open.
// `/api/cases`, `/api/uploads`, `/api/reason` and the case sub-routes all call
// `requireUser`, which returns 401 `unauthenticated` when there is no Clerk
// session. This client has no Clerk integration yet, so those calls are
// implemented and typed but will 401 until one is added — callers fall back to
// fixtures rather than showing an error, which keeps the demo path intact
// (brief §59, PRD §14).

import { Platform } from "react-native";

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}

export type ApiResult<T> =
  | { ok: true; data: T; requestId?: string }
  | { ok: false; error: ApiError; status: number; requestId?: string };

/**
 * Where the backend lives. `localhost` only resolves to this machine, so a
 * phone on the LAN needs the host's IP — set EXPO_PUBLIC_API_URL for that.
 */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  // On web the client is usually served from the same origin as the API.
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

const DEFAULT_TIMEOUT_MS = 12_000;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  /** Clerk session token, once the client has one. */
  token?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, token, idempotencyKey, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  // A hung request must not hang the demo, so every call carries a deadline.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  options.signal?.addEventListener("abort", () => controller.abort());

  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      // Clerk's middleware answers unauthenticated API calls with a 307 to its
      // hosted sign-in page rather than a JSON 401. Following that would hand us
      // an HTML login page and a useless parse error, so redirects are surfaced
      // as the auth failure they actually are.
      redirect: "manual",
    });

    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return {
        ok: false,
        status: response.status || 302,
        error: {
          code: "unauthenticated",
          message: "The backend redirected to sign-in. This endpoint needs a Clerk session.",
          retryable: false,
        },
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { data: T | null; error: ApiError | null; requestId?: string }
      | null;

    if (!response.ok || !payload || payload.error) {
      return {
        ok: false,
        status: response.status,
        requestId: payload?.requestId,
        error: payload?.error ?? {
          code: "unexpected_response",
          message: `Request to ${path} failed (${response.status}).`,
          retryable: response.status >= 500,
        },
      };
    }

    return { ok: true, data: payload.data as T, requestId: payload.requestId };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: {
        code: aborted ? "timeout" : "network_error",
        message: aborted
          ? `The backend did not respond within ${timeoutMs / 1000}s.`
          : "Could not reach the Greenlight backend.",
        retryable: true,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

// --- Typed endpoints ------------------------------------------------------

export interface HealthPayload {
  service: string;
  status: string;
}

export interface CaseStatus {
  id: string;
  status: string;
  executionMode: string;
}

/** Open endpoint — the one call that works without a Clerk session. */
export const getHealth = () => apiRequest<HealthPayload>("/api/health");

/** Requires auth. 401 `unauthenticated` until Clerk is wired into the client. */
export const createCase = (token?: string, idempotencyKey?: string) =>
  apiRequest<CaseStatus>("/api/cases", { method: "POST", token, idempotencyKey });

export const getCaseStatus = (id: string, token?: string) =>
  apiRequest<CaseStatus>(`/api/cases/${id}/status`, { token });

export const getCaseResult = (id: string, token?: string) =>
  apiRequest<unknown>(`/api/cases/${id}/result`, { token });

/** True when the backend is reachable — drives the live/demo badge. */
export async function isBackendReachable(): Promise<boolean> {
  const result = await getHealth();
  return result.ok && result.data.status === "ok";
}
