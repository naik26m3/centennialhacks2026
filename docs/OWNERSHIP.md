# Shared-main ownership

Claim a path before editing it. One owner works in a path at a time, verifies
their slice, commits only that scope, and then marks it available.

| Scope | Owner | Status |
|---|---|---|
| `app/api/**`, `lib/reasoning/**`, `tests/reasoning.test.ts` | backend/reasoning agent | active |
| `lib/ocr/**` | OCR teammate | reserved |
| pages, `components/**`, styles | frontend teammate | reserved |
| `docs/PRD.md` | product research | complete |
| root config, lockfiles, `AGENTS.md`, `docs/OWNERSHIP.md` | coordinating agent | active |

Shared contracts belong in `lib/contracts/**`. Coordinate changes to those
files here before editing; do not reach into another owner's implementation.
