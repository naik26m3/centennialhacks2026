# Greenlight — Devpost draft

## Inspiration
Governments and utilities already offer real money for going green — rebates, tax
credits, financing. The problem was never that people don't want to save the planet.
It's that claiming what's already owed to you means navigating government websites,
PDFs, eligibility rules, and the wrong department three times before you find the
right one. We wanted an agent that does that work instead of asking a person to
become a part-time bureaucracy expert.

## What it does
Upload a utility bill. Greenlight reads it, builds a household profile, matches it
against real Ontario incentive programs, and shows the total dollar value on the
table. Pick an opportunity and click "Get it for me" — Greenlight verifies the
program, resolves who actually administers it, checks a couple of eligibility
questions with you directly, and prepares an application packet and a drafted
message, stopping short of ever submitting anything without your approval.

## How we built it
Next.js App Router, TypeScript, Tailwind, Framer Motion. A deterministic demo-mode
data layer stands in for live Gemini calls so the judged demo never depends on
network conditions — the same adapter interface a live `GeminiAnalysisProvider`
would implement is already defined and ready to wire in.

## How Gemini is used
Three real jobs, not one API call bolted onto a form: multimodal extraction of the
utility bill, reasoning over eligibility against a structured incentive dataset, and
drafting the actual outbound communication. Financial arithmetic is always
deterministic TypeScript — Gemini interprets, code calculates.

## How verified contact routing works
Every incentive program carries a structured, sourced `ActionRoute` — the
administering organization, the correct submission channel, and a source URL with a
last-verified date. If a route can't be verified, the product says so honestly
instead of inventing a plausible-looking contact.

## Challenges
Getting the incentive data right mattered more than getting the UI polished — we
verified every dollar figure against Enbridge Gas and Save on Energy's live pages
rather than trusting a first-pass web search, since a judge checking a number live is
the single fastest way to lose credibility.

## Accomplishments
A fully deterministic, dependency-free demo path that runs with zero API keys and
zero external services, built directly from a comprehensive product spec.

## What we learned
Financial credibility is the actual product here, not the UI. The trust model —
never fabricating a contact, never claiming to have submitted something — mattered
as much as the agent behavior itself.

## What's next
Real Gemini wiring for live bill extraction, Supabase persistence, and expansion
beyond Ontario's Home Renovation Savings program to the rest of Canada's provincial
incentive landscape.
