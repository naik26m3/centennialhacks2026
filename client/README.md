# Greenlight — universal client (`client/`)

Expo + React Native + TypeScript. One codebase that runs in a desktop browser and
on a phone, ported from the design in `uxui/`.

The underscore prefix matters: Next.js treats `client/` as a private folder and
keeps it out of routing. Without it, Next scans this project's node_modules and
registers files like `lucide-react-native/.../icons/route.js` as real API routes,
which breaks the root build.

## Run it

```bash
cd client
npm install

npm run web        # desktop browser
npm start          # QR code -> Expo Go on a phone
npm run android    # Android emulator/device
npm run ios        # iOS (macOS only)
```

## Stack, and one substitution you should know about

| Asked for | Used | Why |
|---|---|---|
| Tailwind | **NativeWind 4.2** | Tailwind class names compiled for React Native. Same `className` syntax on both targets. |
| shadcn/ui | **`src/components/ui/*`**, shadcn-shaped | shadcn/ui generates Radix + Tailwind components that are **DOM-only** — they cannot run on React Native. These are the same API shape (`Button`, `Card`, `Badge`, `Text`, `Separator`) built on RN primitives, in the style of `react-native-reusables`. |
| assistant-ui | **`@assistant-ui/react-native` 0.1.36** | The official RN binding. Used on `/goal` only. |
| Expo | **SDK 57**, RN 0.86, React 19.2 | Expo Router for file-based routing across web and native. |

### assistant-ui is deliberately not the main interface

Build brief §7 is explicit: *"DO NOT BUILD A CHATBOT AS THE MAIN INTERFACE."* It does
allow "a small conversational command field for goals," which is exactly §25's
*"What do you want Greenlight to optimize?"*

So assistant-ui powers one screen, `/goal`, and even there the transcript is hidden —
the visible answer is a **plan**, not a chat log. The model interprets the sentence;
`src/lib/goal-parser.ts` and the solver do the arithmetic, per §25 ("Gemini interprets.
TypeScript calculates") and PRD §11 ("Gemini may not calculate or alter benefits").

## Screens

| Route | Brief | What it does |
|---|---|---|
| `/` | Scene 1 §8 | "What are you leaving on the table?" + upload |
| `/analyze` | Scene 2 §9 | Deterministic analysis sequence, ~2.3s, honours reduced-motion |
| `/opportunities` | Scene 3 §10 | Hero value number, then the opportunity list |
| `/opportunity/[id]` | §30 | Value → eligibility → economics → evidence → verified route |
| `/agent/[caseId]` | §13, §23 | Observable agent actions; stops to ask "own or rent?" and confidence visibly rises |
| `/plan` | §26 | Negotiated plan with each value category on its own line |
| `/goal` | §25 | Natural-language goal → structured constraints → solved plan |

## Why this runs on a phone properly

- **Camera capture** (`src/components/bill-uploader.tsx`) — `expo-image-picker` lets you
  photograph a bill instead of uploading a file. Brief §31 asks for exactly this, and it's
  the one thing a responsive web app can't do as well.
- **44px minimum touch targets**, no hover-dependent behaviour (§33).
- **Sticky bottom CTAs** on scrollable screens (§29), one dominant action per screen (§69).
- `max-w-2xl mx-auto` on every screen so the desktop build doesn't stretch text to 1400px (§28).

## Design tokens

`tailwind.config.js` carries the exact palette from `uxui/app/globals.css` —
canvas `#faf9f5`, ink `#17171a`, brand `#1f5c3f`. Verified in the compiled CSS:
`.bg-canvas` → `rgb(250 249 245)`. Green is reserved for financial success, never
decoration (§38).

## State of the data

Everything renders from `src/lib/fixtures.ts` — a synthetic Toronto household, clearly
marked sample data. Program amounts and URLs are the real Ontario Home Renovation
Savings figures verified 2026-08-15, but no live API is wired up yet.

To go live, replace the fixture reads with calls to the root app's route handlers.
`/analyze` already receives the picked file's `uri` and `mimeType` as route params, so
it's the natural place to POST the document once an upload route exists.

## Verified

- `npx tsc --noEmit` — clean
- `npx expo export --platform web` — 9 routes, static rendering, 11KB CSS
- Not yet run on a physical device or emulator. Do that before demoing — the camera
  path in particular has never been executed.
