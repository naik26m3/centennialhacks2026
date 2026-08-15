# Shared-main ownership

Claim a path before editing it. One owner works in a path at a time, verifies
their slice, commits only that scope, and then marks it available.

| Scope | Owner | Status |
|---|---|---|
| `app/api/**`, `lib/reasoning/**`, `tests/reasoning.test.ts` | backend/reasoning agent | active |
| `lib/eligibility/**`, `lib/financial/**`, `tests/engines.test.ts` | deterministic-engine agent | active |
| `db/**` | database agent | active |
| `lib/ocr/**` | OCR teammate | reserved |
| `uxui/**` | frontend teammate | reserved — do not touch |
| `docs/PRD.md` | product research | complete |
| root package/config, `AGENTS.md`, `docs/OWNERSHIP.md` | coordinating agent | active |

Shared contracts belong in `lib/contracts/**`. Coordinate changes to those
files here before editing; do not reach into another owner's implementation.
