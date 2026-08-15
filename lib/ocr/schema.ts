// Structured-output schema for bill extraction.
//
// This is the *model-facing* schema — what the AI layer is asked to return. It
// is deliberately shaped like the document (what's printed on the page), not
// like the application. The application-facing contract is the canonical
// UtilityBill in lib/ocr/contract.ts (PRD §6.2), which this maps into.
//
// Field coverage follows the PRD's Textract query list (§5.2): provider, total
// due, due date, billing period, billing days, kWh, rate plan, on/mid/off-peak
// usage, postal code, account number.

import { z } from "zod";
import type { UtilityBill } from "./contract";

export const TimeOfUseSchema = z.object({
  onPeakKwh: z.number().nullable(),
  midPeakKwh: z.number().nullable(),
  offPeakKwh: z.number().nullable(),
});

export const BillExtractionSchema = z.object({
  documentType: z.enum([
    "electricity_bill",
    "natural_gas_bill",
    "combined_utility_bill",
    "water_bill",
    "other",
  ]),
  provider: z.string().nullable(),
  accountType: z.enum(["residential", "commercial", "unknown"]),
  // Only the last 4 characters. The full account number is never requested,
  // returned, or persisted (brief §47; PRD §13 says mask account numbers before
  // sending data to a model — we go further and never ask for the full value).
  accountNumberLast4: z.string().nullable(),
  serviceAddress: z.object({
    city: z.string().nullable(),
    provinceState: z.string().nullable(),
    postalCode: z.string().nullable(),
    country: z.string().nullable(),
  }),
  billingPeriod: z.object({ start: z.string().nullable(), end: z.string().nullable() }),
  dueDate: z.string().nullable(),

  electricity: z.object({ usageKwh: z.number().nullable(), cost: z.number().nullable() }).nullable(),
  naturalGas: z.object({ usageM3: z.number().nullable(), cost: z.number().nullable() }).nullable(),

  // Rate plan and time-of-use split drive program matching and savings estimates.
  ratePlan: z.string().nullable(),
  timeOfUse: TimeOfUseSchema.nullable(),

  // Split out separately because they mean different things to the programs:
  // LEAP keys off arrears and disconnection risk (PRD §10).
  totalAmount: z.number().nullable(),
  currentCharges: z.number().nullable(),
  arrears: z.number().nullable(),
  currency: z.string(),

  detectedHeatingClues: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  missingCriticalFields: z.array(z.string()),
});

export type UtilityBillExtraction = z.infer<typeof BillExtractionSchema>;

/**
 * How a given extraction was produced. PRD §2.1 wants `textract_gemini` to be
 * the primary path; `gemini_direct` is the ENABLE_GEMINI_FALLBACK path (§15)
 * and is what runs today. `demo_fixture` is PRD §18 DEMO mode.
 */
export type ExtractionStrategy = "textract_gemini" | "gemini_direct" | "demo_fixture";

// Derived, code-calculated figures. The model never does arithmetic (brief §62,
// PRD §9.1) — these are computed in lib/ocr/annualize-usage.ts.
export interface AnnualizedUsage {
  billingDays: number | null;
  dailyElectricityKwh: number | null;
  annualElectricityKwh: number | null;
  annualNaturalGasM3: number | null;
  annualCost: number | null;
  basis: "billing_period" | "insufficient_data";
}

export interface ExtractionMeta {
  strategy: ExtractionStrategy;
  mode: "live" | "demo";
  model: string | null;
  attempts: number;
  latencyMs: number;
  fileName: string | null;
  mimeType: string;
  sizeBytes: number;
}

export type ExtractionErrorCode =
  | "unsupported_type"
  | "file_too_large"
  | "empty_file"
  | "model_error"
  | "invalid_output";

export type BillExtractionOutcome =
  | {
      ok: true;
      /** The canonical contract — this is what consumers should use. */
      canonical: UtilityBill;
      /** Document-shaped intermediate. Useful for debugging; not a contract. */
      bill: UtilityBillExtraction;
      usage: AnnualizedUsage;
      meta: ExtractionMeta;
    }
  | { ok: false; code: ExtractionErrorCode; error: string; meta: ExtractionMeta };
