# Greenlight Preview/demo runbook

Status: hackathon Preview only, audited 2026-08-15. Main is pushed through
`a2aafcf`. This document records verified external state and blockers; it does
not claim that the complete bill-to-action flow is ready.

## Demo target and current state

- Use the stable public API base: <https://centennialhacks2026.vercel.app>.
  It points to the verified Preview-built deployment (Preview environment and
  development Clerk configuration). The underlying deployment URL is
  <https://centennialhacks2026-63z2thkye-daveta.vercel.app>; AWS CORS is now
  updated for the stable alias.
- Vercel SSO protection is disabled, so a team seat/login is not required.
  The accidental production-target deployment is unused and is not part of
  the demo; there is no Production setup in this runbook.
- `GET /api/health` returned `{ "data": { "service": "greenlight-api",
  "status": "ok" }, "error": null }`.
- Preview has 14 expected environment names configured. Values are kept in
  deployment settings and ignored local files; never copy them into docs,
  tickets, screenshots, or logs.
- Railway's base schema is externally verified at 16 tables, 14 enums, and 5
  program identities. Full-text source ingestion loaded 9/9 official sources
  as 88 chunks; all are pending review and there are zero vectors.
- CloudFormation is `UPDATE_COMPLETE`; S3 is private, uses one-day `cases/`
  expiry, trusts the Preview deployment through Vercel OIDC, and its CORS was
  updated for the stable alias. Verify the browser PUT/checksum smoke before
  treating uploads as end-to-end complete.
- The user enabled PostgreSQL `vector` and applied migration 002 successfully;
  the database now has 3 embedding columns and an HNSW index. Vector ingestion
  was attempted for all 9 sources but 0/9 succeeded: both embedding-model
  diagnostics returned HTTP 401 `User not found` while the auth/key metadata
  endpoint returned 200. The 88 full-text chunks remain intact and are the MVP
  retrieval path until a fresh OpenRouter key is available.
- The Vercel bypass token was revoked. Do not recreate or document a bypass
  token for the demo.

## Available API surface

All routes below are relative to the stable API base. The health route is
public. The case, upload, and reasoning routes require a Clerk session; an
unauthenticated request currently surfaces Clerk/Next middleware 404, which is
not an authenticated smoke test.

- `GET /api/health`
- `POST /api/cases`
- `GET /api/cases/:id/status`
- `POST /api/uploads`
- `POST /api/reason`

Successful case/status responses use the existing envelope:

```json
{
  "data": {
    "caseId": "uuid",
    "status": "created",
    "executionMode": "demo",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  },
  "error": null,
  "requestId": "uuid"
}
```

Create a case with an idempotency key, retain `data.caseId`, then poll
`GET /api/cases/:id/status` with the same Clerk session. Poll until the status
is terminal (`ready`, `action_prepared`, `approved`, or `failed`); a `failed`
response carries a retryable `processing_failed` error. The currently shipped
surface does not yet expose the PRD analyze/result/action routes.

## OCR and execution modes

- The Textract foundation is pushed in `e73043d` and unit-tested, but the
  live AWS call returned `SubscriptionRequiredException`.
- The explicit fallback worker is pushed in `a2aafcf`; 27 tests, typecheck, and
  build pass. The approved live smoke reached OpenRouter but returned HTTP 401
  `AI_APICallError`; output was suppressed and no OCR result or latency is
  claimed. It is not complete until the credential/network blocker is resolved
  and a live smoke reports latency.
- `demo` mode requires a synthetic or manually redacted fixture and must be
  explicit in case metadata/logs. `live` and `hybrid` remain verification
  targets, not a promise that the full pipeline is currently available.

## Preflight and reset

1. Open the stable API base and confirm `/api/health` reports `status: ok`.
2. Sign in with the configured development Clerk instance; do not use an
   unauthenticated 404 as evidence of authorization.
3. Use only a synthetic/redacted bill fixture. Confirm the selected execution
   mode before creating a case.
4. Create one case with an idempotency key and poll its status. Stop if the
   flow reaches an unimplemented route or reports a non-retryable error.
5. Do not run a broad database or bucket delete. For a repeat demo, use a new
   test case; after the demo, remove only the known case/document through an
   implemented owner-approved cleanup path, and preserve `tests/file/`.

## What remains for the hackathon

- [ ] Obtain a fresh OpenRouter key, rerun embedding ingestion for all 9
      sources, and verify vector retrieval; migration 002/HNSW is already
      applied, while full-text remains the MVP fallback.
- [ ] Resolve the OpenRouter OCR credential/network blocker and verify a live
      fallback smoke with latency, or resolve Textract's subscription before
      relying on live OCR.
- [ ] Run an authenticated Clerk case → upload → reasoning end-to-end smoke,
      including real private-S3 PUT/HEAD/checksum verification.
- [ ] Review and approve all program sources and deterministic rules.
- [ ] Finish the missing analyze, result, action-prepare, and action-approve
      APIs and status transitions.
- [ ] Complete frontend integration against the stable API base and the
      existing envelope/status polling contract.
- [ ] After the hackathon, rotate the leaked OpenRouter key and decommission
      the demo Preview configuration; never record replacement values here.
