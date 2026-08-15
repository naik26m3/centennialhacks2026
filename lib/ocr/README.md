# OCR / bill extraction (`lib/ocr/**`)

Turns a utility bill (PDF, scan, or phone photo) into the canonical
`UtilityBill` contract in [`contract.ts`](./contract.ts).

Owned by the OCR teammate per [docs/OWNERSHIP.md](../../../docs/OWNERSHIP.md).
Consume the `lib/ocr` barrel; don't reach into the implementation.

## Status: Gemini-only, contract-complete

The PRD (§2.1) specifies **Amazon Textract as the OCR layer**, with Gemini
narrowed to semantic normalization of Textract output. **That is not built yet** —
it needs AWS credentials, a private S3 bucket, and presigned uploads, none of
which are configured.

What runs today is the `gemini_direct` strategy — the PRD's own
`ENABLE_GEMINI_FALLBACK` path (§15) — sending the document straight to Gemini.

The seam is already in place, so adding Textract does not change any consumer:

- `ExtractionStrategy` = `textract_gemini | gemini_direct | demo_fixture`, reported on every result
- `ExtractedField.source` already includes `textract_query | textract_form | textract_line`
- `ExtractedField.confidence` is `null` today and `evidence: []`; Textract fills both in
- `prompts.ts` already contains `textractNormalizationPrompt()` for the §2.1 flow

Adding Textract means writing `textract-image.ts` / `textract-pdf.ts`, then
calling that prompt instead of the direct read. Nothing else moves.

## A note on where the contract lives

The canonical contract is [`contract.ts`](./contract.ts) inside this folder.
Per AGENTS.md it belongs at `lib/contracts/bill.ts`, but that path needs
coordination in docs/OWNERSHIP.md first, so it is parked here to keep this slice
self-contained. Moving it is a file move plus one import line — nothing else
references it by path.

## Usage

```ts
import { extractBill } from "@/lib/ocr";

const result = await extractBill({ data: buffer, mimeType, fileName });

if (result.ok) {
  result.canonical; // UtilityBill — the contract. Use this.
  result.usage;     // billing days, daily/annualized figures (code-calculated)
  result.meta;      // strategy, mode, model, attempts, latencyMs
} else {
  result.code;      // unsupported_type | file_too_large | empty_file | model_error | invalid_output
  result.error;     // human-readable
}
```

Server-only — reads `GEMINI_API_KEY`. Never import from a client component.

## Trying it on a real bill

`app/api/**` belongs to the backend agent and pages belong to the frontend
teammate, so the OCR slice ships with its own local harness instead of editing
either. It is **not** part of the app build and is never deployed.

```bash
# from the repo root, with GEMINI_API_KEY in .env.local
# requires @google/genai + zod + tsx in the root package.json (coordinating agent owns it)
npx --yes tsx lib/ocr/dev/harness.ts
# -> http://localhost:4000
```

Drop in a bill and you get the canonical JSON with a copy/download button, a
field-by-field table showing `source` and `needsConfirmation`, and the
code-calculated figures kept visually separate from the read ones.

**Without an API key it still runs**, returning the synthetic
`DEMO_EXTRACTION` fixture — PRD §5.3, "keep a fixture extractor so a cloud
timeout cannot break the presentation."

When an upload route exists, delete `dev/` and call `extractBill()` from it.

## The pipeline

1. **Guard the input** — MIME type, size ≤ 15 MB, and **magic-byte signature**
   (PRD §5.1), which is the only check a caller can't lie about. Each failure
   returns a typed `code`.
2. **Read the document** at `temperature: 0` with a JSON response schema.
3. **Validate with Zod.** Unvalidated model output never reaches the financial
   layer (brief §60).
4. **Retry once, intelligently** — if Zod rejected the output, restate the format
   rules with the actual validation error; if the *API* rejected the schema, drop
   it and describe the shape in prose.
5. **Normalize and mask deterministically** — account number to **last 4 only**,
   postal code to **prefix only**. Neither full value is ever requested or stored
   (brief §47, PRD §13).
6. **Recompute what's missing**, adding what downstream needs and can't get.
7. **Calculate in code** — `dailyUsageKwh = totalUsageKwh / billingDays`, ×365
   (PRD §9.1). The model never does arithmetic.
8. **Map to the canonical contract**, wrapping every value with its source,
   confirmation state, and validation errors.

## Two deliberate choices worth knowing

**No per-field confidence.** Gemini returns one confidence for the whole
document. Splitting it across fields would be exactly the fake precision PRD §2.5
warns against, so `ExtractedField.confidence` is `null` and low document
confidence instead flips `needsConfirmation` globally. Textract supplies real
per-field values later.

**Non-CAD bills aren't silently mislabelled.** PRD §6.2 names the money fields
`*Cad`. A non-CAD bill keeps its amount and gains a `validationErrors` entry
rather than being quietly relabelled.

## Testing notes

Verified live against `gemini-3.6-flash` on a synthetic Toronto Hydro bill:
provider, 947 kWh, $164.54, the billing period, `M6H` prefix and `••••6640` all
read correctly — while **ignoring** a "same period last year: 1,012 kWh" line and
a previous balance, both distractors a regex parser would have grabbed.

A non-bill document (a course registration PDF with a `1,842.00 CAD` total)
returned `confidence: 0`, all fields null, and "document does not appear to be a
utility bill" — it did **not** report the tuition as a bill total.

Still worth testing: a real bill, a phone photo, and a bill with the total
cropped off. Confidence should visibly drop on the photo.

Use synthetic or redacted bills where possible (PRD §13). `.env*` is gitignored;
keep real bills out of the repo.

Live latency is ~7 s, above the brief's 2–5 s target (§9). The analysis animation
covers it; Textract + a smaller normalization prompt is the likely fix.
