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

- Node.js 22 or newer
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

Copy [`.env.example`](.env.example) to the ignored `.env.local` file and fill
in the required values. These two files are the canonical application
configuration; never commit `.env.local`.

## API

- `GET /api/health` — service health
- `POST /api/reason` — grounded reasoning through OpenRouter via the Vercel AI SDK

The reasoning route returns real-time web research with source links marked as
unreviewed. Reviewed program evidence comes from PostgreSQL retrieval;
deterministic backend code owns eligibility and financial calculations.

## Project structure

Keep backend work isolated from the frontend teammate:

- `app/api/` — backend Route Handlers
- `lib/reasoning/` — grounded retrieval and model explanations
- `lib/ocr/` — reserved for the OCR teammate
- `uxui/` — frontend teammate's application; backend agents do not touch it
- `docs/` — product requirements and ownership coordination
- `public/` — root application static assets

Use Next.js Route Handlers for backend functionality.
