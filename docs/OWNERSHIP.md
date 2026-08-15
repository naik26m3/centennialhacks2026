# Shared-main ownership

Claim a path before editing it. One owner works in a path at a time, verifies
their slice, commits only that scope, and then marks it available.

| Scope | Owner | Status |
|---|---|---|
| `backend/app/api/**`, `backend/lib/reasoning/**`, `backend/tests/**` | backend/reasoning agent | active |
| `backend/lib/ocr/**` | OCR teammate | reserved |
| `uxui/**` | frontend teammate | reserved — do not touch |
| `docs/PRD.md` | product research | complete |
| `backend/package.json`, backend lockfile/config | backend/reasoning agent | active |
| root config, `AGENTS.md`, `docs/OWNERSHIP.md` | coordinating agent | active |

Shared contracts belong in `backend/lib/contracts/**`. Coordinate changes to those
files here before editing; do not reach into another owner's implementation.
