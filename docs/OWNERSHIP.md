# Shared-main ownership

Claim a path before editing it. One owner works in a path at a time, verifies
their slice, commits only that scope, and then marks it available.

| Scope | Owner | Status |
|---|---|---|
| `app/api/**`, `lib/reasoning/**`, `tests/reasoning.test.ts` | backend/reasoning agent | active |
| `lib/eligibility/**`, `lib/financial/**`, `tests/engines.test.ts` | deterministic-engine agent | active |
| `db/**` | database agent | active |
| `data/legal-sources.json`, `lib/ingestion/**`, `tests/ingestion.test.ts` | backend/RAG agent | complete — available |
| `infra/aws/**` | AWS infrastructure agent | complete — available |
| `lib/ocr/**` | OCR teammate | reserved |
| `uxui/**` | frontend teammate | reserved — do not touch |
| `README.md`, `docs/PRD.md`, `docs/BACKEND_TODO.md`, `docs/OWNERSHIP.md` | documentation cleanup agent | complete — available |
| root package/config, `AGENTS.md` | coordinating agent | active |

Shared contracts belong in `lib/contracts/**`. Coordinate changes to those
files here before editing; do not reach into another owner's implementation.
