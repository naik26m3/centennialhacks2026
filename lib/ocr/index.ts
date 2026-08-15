// Public surface of the OCR slice (docs/OWNERSHIP.md: `lib/ocr/**`).
//
// Consume this module and `lib/ocr/contract` only — everything else in here
// is implementation and may change without notice. If you need something that
// isn't exported, ask rather than reaching in.
//
// Typical use from a route handler:
//
//   const result = await extractBill({ data: buffer, mimeType, fileName });
//   if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
//   result.canonical; // UtilityBill — the contract
//
// Server-only: reads GEMINI_API_KEY. Never import from a client component.

export { extractBill, ACCEPTED_MIME_TYPES, MAX_FILE_BYTES, DEMO_EXTRACTION } from "./extract-bill";
export { annualizeUsage, billingPeriodDays } from "./annualize-usage";
export { hasLiveGeminiKey } from "./gemini";

export type {
  BillExtractionOutcome,
  ExtractionErrorCode,
  ExtractionMeta,
  ExtractionStrategy,
  AnnualizedUsage,
  UtilityBillExtraction,
} from "./schema";

export type {
  UtilityBill,
  ExtractedField,
  FieldSource,
  BoundingBox,
  ServiceLocation,
  TimeOfUseUsage,
} from "./contract";
export { EXTRACTION_VERSION } from "./contract";
