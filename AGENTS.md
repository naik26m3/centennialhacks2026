# Centennial Hacks agent contract

## Shared skills

Use the upstream skills in `.agents/skills/`. They are copied into this repository so every collaborator and compatible coding agent can use the same guidance. Keep `skills-lock.json` with them.

## Architecture direction

- Treat `docs/PRD.md` as the product and architecture source of truth.
- Build the backend as a TypeScript Next.js App Router application in `backend/`. Use Route Handlers for the API and the Node.js runtime for server integrations.
- Do not add Python, FastAPI, FastMCP, Expo, or a separate backend service.
- Deploy the Next.js application to Vercel, use Clerk for authentication, Railway PostgreSQL for relational data, private Amazon S3 for documents, Textract for OCR/evidence, and Gemini for normalization and explanations.
- Deterministic TypeScript code owns eligibility and financial calculations. Gemini may explain verified results but must not invent eligibility, dollar amounts, contacts, or sources.
- The frontend teammate exclusively owns `uxui/**`. Backend agents must not edit, format, install dependencies in, or generate files inside that directory unless the user explicitly reassigns it.
- The OCR teammate owns `backend/lib/ocr/**`. API/reasoning agents must consume the shared OCR contract and must not edit the OCR implementation.
- Keep the hackathon MVP small: PostgreSQL full-text retrieval over reviewed official-source snapshots is the initial RAG implementation. Add vector infrastructure only after measured need.

## Parallel ownership

- Read `docs/OWNERSHIP.md` before editing and claim an unowned path there first.
- One owner edits a path at a time. Shared root files such as `AGENTS.md` require explicit coordination in the ownership file. Backend package files live under `backend/`.
- Commit only files in your claimed scope. Never stage or commit another agent's unfinished changes.
- Work directly on `main` for this hackathon; do not create branches or worktrees unless the user changes this policy.
- Keep commits atomic and leave `main` buildable. Run the relevant check before each commit.
- Before starting a new slice, fetch and fast-forward only from a clean worktree. Never force-push, reset, or rewrite shared history.

## Git authority

- The user has authorized coding agents to stage, commit, and push completed work in their claimed scope.
- Inspect the staged diff, run checks, and scan for secrets before committing.
- Do not use `--no-verify`, amend another agent's commit, or bypass repository hooks.
- Push only normal fast-forward commits to `main`. Never force-push.
