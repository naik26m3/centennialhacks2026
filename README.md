# Centennial Hacks 2026

Greenlight is a single full-stack Next.js application that turns utility bills
into verified savings opportunities and official next steps. The frontend,
API routes, and server-side logic all use TypeScript.

There is no separate Python backend. Do not add FastAPI or FastMCP.

The current workstream is backend-only. A frontend teammate owns pages,
components, styling, and visual design. See [the PRD](docs/PRD.md) and
[the ownership map](docs/OWNERSHIP.md) before editing.

## Development

Requirements:

- Node.js 20 or newer
- npm

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

Checks:

```bash
npm test
npm run typecheck
```

## Environment

Copy `.env.example` to `.env.local` and provide a Gemini API key. Never commit
the local environment file.

## API

- `GET /api/health` — service health
- `POST /api/reason` — official-source web research with Gemini Google Search

The reasoning route returns the answer, search queries, source links, and the
Google Search entry-point markup. It is research-only: deterministic backend
code will own eligibility and financial calculations.

## Project structure

Keep the application in one Next.js codebase:

- `app/api/` — backend Route Handlers
- `app/` — frontend pages and layouts owned by the UI teammate
- `components/` — reusable UI components
- `lib/reasoning/` — grounded Gemini research
- `lib/ocr/` — reserved for the OCR teammate
- `lib/` — other shared TypeScript utilities and integrations
- `docs/` — product requirements and ownership coordination
- `public/` — static assets

Use Next.js route handlers or server actions for backend functionality. Add a
separate service only when the project has a concrete requirement that Next.js
cannot meet.
