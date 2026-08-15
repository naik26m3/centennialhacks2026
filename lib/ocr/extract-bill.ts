// The extraction pipeline: bytes in, canonical UtilityBill out.
//
//   validate file -> OCR/read -> Zod -> retry once
//   -> deterministic normalization + masking -> billing math -> canonical contract
//
// Ownership: this file is `lib/ocr/**` (docs/OWNERSHIP.md). Consumers should
// import from `lib/ocr` only, never reach in here.
//
// Engine status: currently Gemini-only. PRD §2.1 wants Amazon Textract in front
// as the deterministic OCR layer, with Gemini narrowed to semantic
// normalization. The seam for that is `strategy` below — the canonical contract
// and every consumer of it stay unchanged when Textract lands.

import { z } from "zod";
import {
  BillExtractionOutcome,
  BillExtractionSchema,
  ExtractionMeta,
  ExtractionStrategy,
  UtilityBillExtraction,
} from "./schema";
import {
  BILL_EXTRACTION_PROMPT,
  BILL_EXTRACTION_SHAPE_HINT,
  billExtractionRetryPrompt,
} from "./prompts";
import { generateDocumentJson, getModel, hasLiveGeminiKey, toGeminiJsonSchema } from "./gemini";
import { annualizeUsage } from "./annualize-usage";
import { toCanonicalBill } from "./contract";

// Brief §8 / §31: PDF, PNG, JPG, plus what a phone camera actually produces.
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

// PRD §5.1: validate MIME type, extension, size, and file signature. Magic bytes
// are the only one of those a caller cannot lie about.
const FILE_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

function signatureMatches(data: Buffer, mimeType: string): boolean {
  const expected = FILE_SIGNATURES.filter((s) => s.mime === mimeType);
  // HEIC and the jpg alias have no entry — nothing to contradict, so allow.
  if (expected.length === 0) return true;
  return expected.some(({ bytes, offset = 0 }) =>
    bytes.every((b, i) => data[offset + i] === b)
  );
}

export interface ExtractBillInput {
  data: Buffer;
  mimeType: string;
  fileName?: string;
  signal?: AbortSignal;
}

// --- Deterministic post-processing ---------------------------------------

/** Keep only the last 4 alphanumerics, whatever the model returned. */
function maskAccountNumber(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "");
  return cleaned ? cleaned.slice(-4) : null;
}

/**
 * Postal codes identify a household precisely, and program matching only ever
 * needs the prefix (brief §48, PRD §10 EAP), so the full code is dropped here
 * rather than downstream.
 */
function maskPostalCode(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");
  return cleaned ? `${cleaned.slice(0, 3)} ***` : null;
}

function cleanString(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** A section with nothing in it is noise — collapse it to null. */
function collapseEmpty<T extends Record<string, number | null>>(section: T | null): T | null {
  if (!section) return null;
  return Object.values(section).some((v) => v !== null) ? section : null;
}

/**
 * Fields the rest of the pipeline genuinely needs. The model reports what it
 * could not find; this adds what downstream will miss, so the "needs answers"
 * state is driven by real gaps rather than model mood.
 */
function derivedMissingFields(bill: UtilityBillExtraction): string[] {
  const missing: string[] = [];
  if (!bill.provider) missing.push("utility provider");
  if (!bill.serviceAddress.provinceState) missing.push("service province or state");
  if (bill.electricity?.usageKwh == null && bill.naturalGas?.usageM3 == null) {
    missing.push("metered consumption for this period");
  }
  if (!bill.billingPeriod.start || !bill.billingPeriod.end) missing.push("billing period dates");
  if (!bill.currency.trim()) missing.push("currency");
  return missing;
}

export function normalizeExtraction(raw: UtilityBillExtraction): UtilityBillExtraction {
  const bill: UtilityBillExtraction = {
    ...raw,
    provider: cleanString(raw.provider),
    accountNumberLast4: maskAccountNumber(raw.accountNumberLast4),
    serviceAddress: {
      city: cleanString(raw.serviceAddress.city),
      provinceState: cleanString(raw.serviceAddress.provinceState),
      postalCode: maskPostalCode(raw.serviceAddress.postalCode),
      country: cleanString(raw.serviceAddress.country),
    },
    billingPeriod: {
      start: cleanString(raw.billingPeriod.start),
      end: cleanString(raw.billingPeriod.end),
    },
    dueDate: cleanString(raw.dueDate),
    electricity: collapseEmpty(raw.electricity),
    naturalGas: collapseEmpty(raw.naturalGas),
    ratePlan: cleanString(raw.ratePlan),
    timeOfUse: collapseEmpty(raw.timeOfUse),
    currency: raw.currency.trim().toUpperCase(),
    detectedHeatingClues: raw.detectedHeatingClues.map((c) => c.trim()).filter(Boolean),
    confidence: Math.min(1, Math.max(0, raw.confidence)),
    missingCriticalFields: raw.missingCriticalFields.map((f) => f.trim()).filter(Boolean),
  };

  const merged = [...bill.missingCriticalFields, ...derivedMissingFields(bill)];
  bill.missingCriticalFields = [...new Set(merged.map((f) => f.toLowerCase()))];
  return bill;
}

// --- The pipeline ---------------------------------------------------------

function meta(
  input: ExtractBillInput,
  strategy: ExtractionStrategy,
  attempts: number,
  startedAt: number
): ExtractionMeta {
  return {
    strategy,
    mode: strategy === "demo_fixture" ? "demo" : "live",
    model: strategy === "demo_fixture" ? null : getModel(),
    attempts,
    latencyMs: Date.now() - startedAt,
    fileName: input.fileName ?? null,
    mimeType: input.mimeType,
    sizeBytes: input.data.byteLength,
  };
}

function summarizeZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/** Models sometimes wrap JSON in a markdown fence despite responseMimeType. */
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

export async function extractBill(input: ExtractBillInput): Promise<BillExtractionOutcome> {
  const startedAt = Date.now();
  const mimeType = input.mimeType.toLowerCase().split(";")[0].trim();

  if (input.data.byteLength === 0) {
    return { ok: false, code: "empty_file", error: "That file is empty.", meta: meta(input, "demo_fixture", 0, startedAt) };
  }
  if (!ACCEPTED_MIME_TYPES.includes(mimeType as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return {
      ok: false,
      code: "unsupported_type",
      error: `Unsupported file type "${mimeType}". Upload a PDF, PNG, JPG, or WEBP.`,
      meta: meta(input, "demo_fixture", 0, startedAt),
    };
  }
  if (input.data.byteLength > MAX_FILE_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      error: `That file is ${(input.data.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
      meta: meta(input, "demo_fixture", 0, startedAt),
    };
  }
  if (!signatureMatches(input.data, mimeType)) {
    return {
      ok: false,
      code: "unsupported_type",
      error: `That file's contents don't match its declared type (${mimeType}).`,
      meta: meta(input, "demo_fixture", 0, startedAt),
    };
  }

  // No key configured: the demo path must still work (brief §59, PRD §18).
  if (!hasLiveGeminiKey()) {
    const bill = normalizeExtraction(DEMO_EXTRACTION);
    const usage = annualizeUsage(bill);
    const m = meta(input, "demo_fixture", 0, startedAt);
    return { ok: true, bill, usage, canonical: toCanonicalBill(bill, usage, m), meta: m };
  }

  const fileBase64 = input.data.toString("base64");
  const jsonSchema = toGeminiJsonSchema(BillExtractionSchema);

  let attempts = 0;
  let lastError = "";
  let schemaRejected = false;
  let validationError: string | null = null;

  // Attempt 1 is the straight read. Attempt 2 either restates the format rules
  // (if Zod rejected the output) or drops responseJsonSchema and describes the
  // shape in prose (if the API rejected the schema itself).
  while (attempts < 2) {
    attempts += 1;
    try {
      const instructions = [BILL_EXTRACTION_PROMPT];
      if (validationError) instructions.push(billExtractionRetryPrompt(validationError));
      if (schemaRejected) instructions.push(BILL_EXTRACTION_SHAPE_HINT);

      const rawText = await generateDocumentJson({
        fileBase64,
        mimeType,
        instructions,
        jsonSchema: schemaRejected ? undefined : jsonSchema,
        signal: input.signal,
      });

      const parsed = BillExtractionSchema.safeParse(JSON.parse(stripFences(rawText)));
      if (!parsed.success) {
        validationError = summarizeZodError(parsed.error);
        lastError = validationError;
        continue;
      }

      const bill = normalizeExtraction(parsed.data);
      const usage = annualizeUsage(bill);
      const m = meta(input, "gemini_direct", attempts, startedAt);
      return { ok: true, bill, usage, canonical: toCanonicalBill(bill, usage, m), meta: m };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Never log the document itself (brief §66, PRD §13: no raw OCR text or
      // full bills in logs).
      console.error(`[ocr] attempt ${attempts} failed: ${lastError}`);
      if (/schema/i.test(lastError)) schemaRejected = true;
      if (err instanceof SyntaxError) validationError = "Response was not valid JSON.";
    }
  }

  return {
    ok: false,
    code: validationError ? "invalid_output" : "model_error",
    error: lastError || "The model could not read that document.",
    meta: meta(input, "gemini_direct", attempts, startedAt),
  };
}

// --- Demo fixture ---------------------------------------------------------

/**
 * SAMPLE DATA — synthetic Toronto household, never a real account. Used when no
 * GEMINI_API_KEY is configured, so the upload flow stays demoable offline and on
 * stage (PRD §18 DEMO mode, §5.3 "keep a fixture extractor so a cloud timeout
 * cannot break the presentation").
 */
export const DEMO_EXTRACTION: UtilityBillExtraction = {
  documentType: "electricity_bill",
  provider: "Toronto Hydro",
  accountType: "residential",
  accountNumberLast4: "6640",
  serviceAddress: { city: "Toronto", provinceState: "ON", postalCode: "M6H 1V1", country: "Canada" },
  billingPeriod: { start: "2026-06-03", end: "2026-07-02" },
  dueDate: "2026-07-24",
  electricity: { usageKwh: 947, cost: 164.54 },
  naturalGas: null,
  ratePlan: "RPP - Tiered",
  timeOfUse: null,
  totalAmount: 164.54,
  currentCharges: 164.54,
  arrears: null,
  currency: "CAD",
  detectedHeatingClues: ["delivery - electric heating rate class"],
  confidence: 0.93,
  missingCriticalFields: [],
};
