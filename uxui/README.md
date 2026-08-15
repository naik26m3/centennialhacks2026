# Greenlight

Your personal sustainability negotiator.

> Search is not action. A rebate finder gives you a link. Greenlight gives you an agent.

Built for CentennialHacks — Sustainability & Innovation (primary), MLH Best Use of Gemini (secondary).

## What it does

Upload a utility bill. Greenlight reads it, builds a household profile, matches it
against a curated set of real, currently-active Ontario energy incentive programs,
totals up the dollar value, then walks the highest-value opportunity through:
eligibility evidence, the chain of who actually administers the program, a verified
(or honestly-unverified) contact channel, a pre-filled application packet, and a
drafted message — stopping to ask the user anything it can't infer on its own.

This is not a carbon tracker. It leads with money, not guilt, and it doesn't stop at
"here's a link" — it prepares the actual next step.

## Why it's demo-mode by default

The app ships with **no external dependencies required to run**. Every "Gemini call"
described in the build brief has a deterministic, fixture-backed implementation in
`lib/adapters/demo-provider.ts`, matching the `AnalysisProvider` adapter pattern the
brief specifies (section 59). This means:

- `npm install && npm run dev` works immediately, no API keys, no Supabase project.
- The judged demo path is fully reproducible — no risk of a live model call being
  slow, rate-limited, or flaky mid-pitch.
- Every dollar figure in the fixture dataset (`lib/data/fixtures.ts`) is real: Ontario's
  Home Renovation Savings program (Enbridge Gas + Save on Energy + Government of
  Ontario), confirmed running through November 2026 as of August 2026. Re-verify
  amounts against the live Enbridge pages before any real (non-demo) use — incentive
  programs change.

## Architecture

```
app/                    Next.js App Router routes (one per screen in the brief)
  page.tsx              Landing — upload / try demo household
  analyze/               Cinematic analysis sequence
  opportunities/          Value reveal + findings list
  opportunity/[id]/       Opportunity detail — evidence, economics, "Get it for me"
  agent/[caseId]/         Agent execution — timeline, administrator chain, application
  plan/                   Negotiator — goal input, negotiated plan

lib/
  types.ts               Core domain types (bill, household, opportunity, agent case)
  data/fixtures.ts        Demo household + real, sourced Ontario incentive dataset
  ai/schemas.ts            Zod schemas validating every Gemini structured-output response
  ai/gemini.ts             Real Gemini calls — bill extraction + eligibility reasoning
  adapters/demo-provider.ts  Deterministic stand-ins for the same steps, no key required
  adapters/live-provider.ts  Household-from-bill mapping + Gemini-backed eligibility
                            matching, sharing the same deterministic dollar math
  calculations/            All financial arithmetic — payback, net cost, constraint
                            solver. Gemini never does this math; TypeScript does, in
                            both the demo and live paths.
  context/                 React Context holding cross-screen state, persisted to
                            sessionStorage so a page refresh mid-flow doesn't lose
                            progress (no backend needed — no auth, no database)

components/               UI building blocks (AgentTimeline, AdministratorChain,
                           EligibilityMatrix, ApplicationPacket, NegotiatedPlanView, ...)

app/api/analyze/route.ts  Server-only route: accepts an uploaded bill, calls Gemini if
                           GEMINI_API_KEY is set, falls back to the demo fixtures on any
                           failure or missing key.
```

## Going live with real Gemini

1. Get a key from [Google AI Studio](https://aistudio.google.com/apikey) and add
   `GEMINI_API_KEY` to `.env.local` — never commit it, never expose it client-side.
   `lib/ai/gemini.ts` is server-only and reads it directly from `process.env`.
2. That's it — `app/api/analyze/route.ts` detects the key automatically. With it set,
   "Upload a bill" sends the real file to Gemini (`gemini-3.6-flash`) for extraction,
   builds a household profile from what the bill actually shows (no fabricated dwelling
   type or usage), and runs a Gemini eligibility assessment per program — while region
   and homeowner-status checks, and all dollar math, stay deterministic TypeScript.
   Without a key (or if any live call fails), it falls back to the demo fixtures
   automatically — the badge in the UI reflects which path a given session used
   ("Live · Gemini-analyzed" vs. "Demo mode · sample household").
3. Real persistence (Supabase, contact verification against live official sources,
   auth) is intentionally P1/P2 — see the original build brief for the full schema
   if you want to build it out.

## Safety model

- Gemini interprets, TypeScript calculates — all dollar math is deterministic.
- No fabricated contacts: any real (non-demo) build must only surface contact
  information from a verified, structured, sourced dataset — never model-invented.
- No auto-submission: drafts require explicit user approval before anything is sent.
- Demo data is clearly synthetic and labeled as such in code.

## Running it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, click "Try a demo household."

## Visual asset provenance

- `public/images/greenlight-meadow.webp` is an original AI-generated hero
  background created specifically for Greenlight on 2026-08-15 with OpenAI's
  built-in image-generation tool. It contains no third-party logos or source
  photography and was compressed locally to WebP for the app.
