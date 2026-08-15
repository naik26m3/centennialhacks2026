# Shared-main ownership

Claim a path before editing it. One owner works in a path at a time, verifies
their slice, commits only that scope, and then marks it available.

| Scope | Owner | Status |
|---|---|---|
| `app/api/health/**`, `app/api/reason/**`, `lib/reasoning/**`, `tests/reasoning.test.ts` | backend/reasoning agent | complete — available |
| `lib/eligibility/**`, `lib/financial/**`, `tests/engines.test.ts` | deterministic-engine agent | active |
| `db/**` | database agent | active |
| `lib/ingestion/**` | backend/RAG agent | complete — available |
| `data/legal-sources.json`, `tests/ingestion.test.ts` | ten-program catalog side task | complete — available |
| `infra/aws/**` | AWS infrastructure agent | complete — available |
| `scripts/ingest-legal-sources.ts`, `tests/ingest-script.test.ts` | embedding-ingestion Luna agent | active |
| `lib/ocr/**`, `scripts/ocr-smoke.ts`, `tests/ocr.test.ts` | Gemini OCR Luna agent | active — user reassigned for this slice |
| `app/api/documents/[documentId]/analyze/**` | document-pipeline Luna agent | complete — available |
| `app/api/documents/[documentId]/fields/**`, `lib/documents/**`, `tests/documents.test.ts` | field-review Luna agent | active |
| `app/api/opportunities/**`, `app/api/actions/**`, `lib/actions/**`, `tests/actions.test.ts` | action-safety Luna agent | active |
| `app/api/cases/[id]/answers/**`, `app/api/cases/[id]/evaluate/**`, `lib/evaluation/**`, `tests/evaluation.test.ts` | evaluation-trigger Luna agent | active |
| `db/seeds/003_program_registry.sql`, `tests/program-registry.test.ts` | program-registry Luna agent | active |
| `app/api/uploads/[documentId]/complete/**`, `tests/upload-complete.test.ts` | upload-completion Luna agent | active |
| `scripts/full-pipeline-smoke.ts` | coordinating agent | active |
| `app/api/analyze/**`, `tests/analyze-route.test.ts` | coordinating backend agent | active |
| `lib/ai/gemini.ts`, `lib/ai/schemas.ts`, `lib/adapters/live-provider.ts`, `tests/live-provider.test.ts` | coordinating backend agent | complete — available |
| `uxui/**` | Codex final experience transformation | complete — available |
| `scripts/build-claude-review.mjs`, `GREENLIGHT_CLAUDE_REVIEW.html` | Codex final experience dossier refresh | complete — available |
| `README.md`, `docs/PRD.md` | documentation cleanup agent | complete — available |
| `docs/BACKEND_TODO.md`, `docs/OWNERSHIP.md`, `docs/DEPLOYMENT_RUNBOOK.md` | backend documentation status sync | complete — available |
| root package/config, `AGENTS.md` | coordinating agent | active |

Shared contracts belong in `lib/contracts/**`. Coordinate changes to those
files here before editing; do not reach into another owner's implementation.
