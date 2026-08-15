# Centennial Hacks agent contract

## Shared skills

Use the upstream skills in `.agents/skills/`. They are copied into this repository so every collaborator and compatible coding agent can use the same guidance. Keep `skills-lock.json` with them.

## Architecture direction

- Build the backend as a FastAPI **DDD modular monolith**: one deployable application, bounded contexts isolated by feature, and explicit public module boundaries. Do not split services unless the user asks.
- Keep the API FastMCP-compatible. Use the upstream FastAPI, FastMCP, and MCP Builder skills when designing HTTP or MCP interfaces.
- Build mobile clients with React Native and Expo. Use the Expo design-system, router, native-UI, data-fetching, and Tailwind/NativeWind skills when relevant.
- Assistant UI is optional. Only introduce it when the designer or user chooses it for an AI interface; its presence in this repo is not a mandate.
- Deploy the FastAPI backend to Railway. Use Vercel for web frontend/serverless work when appropriate. Do not create or modify direct AWS infrastructure unless the user explicitly requests it.

## Git authority

- Coding agents must never run `git commit`, including `--no-verify`, amend, or any workaround that bypasses this rule.
- Coding agents must not set `ALLOW_HUMAN_COMMIT`, edit/unset `core.hooksPath`, or alter `.githooks/pre-commit` to bypass the guard.
- Do not stage changes unless the user explicitly asks. The human owner reviews and commits.
- A human can intentionally commit with `ALLOW_HUMAN_COMMIT=1 git commit ...`.
