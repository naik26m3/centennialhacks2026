# Centennial Hacks 2026

Greenlight is one Next.js and TypeScript application that turns utility bills
into verified savings opportunities and official next steps. The frontend
teammate owns `uxui/` and will port its design into the root application.

There is no separate Python backend. Do not add FastAPI or FastMCP.

The current workstream is backend-only. A frontend teammate exclusively owns
`uxui/`; backend agents must not modify anything there. See
[the PRD](docs/PRD.md) and [the ownership map](docs/OWNERSHIP.md) before
editing.

## Development

Requirements:

- Node.js 20 or newer
- npm

```bash
npm install
npm run dev
```

The API is available at [http://localhost:3000/api](http://localhost:3000/api).

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

Keep backend work isolated from the frontend teammate:

- `app/api/` — backend Route Handlers
- `lib/reasoning/` — grounded Gemini research
- `lib/ocr/` — reserved for the OCR teammate
- `uxui/` — frontend teammate's application; backend agents do not touch it
- `docs/` — product requirements and ownership coordination
- `public/` — root application static assets

Use Next.js Route Handlers for backend functionality.
