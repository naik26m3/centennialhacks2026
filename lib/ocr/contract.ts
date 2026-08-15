// The application-facing contract — PRD §6.1 (ExtractedField) and §6.2
// (UtilityBill). This is what the rest of Greenlight consumes; everything
// upstream of it is an implementation detail of the extraction layer.
//
// Why the envelope matters: every value carries where it came from, whether a
// human still needs to confirm it, and what failed validation. That is what lets
// the UI show "3 of 5 required conditions confirmed; 2 answers still needed"
// (PRD §8) instead of a single opaque confidence number (PRD §2.5).
//
// The `source` enum already includes the textract_* variants. When Textract is
// added in front of Gemini (PRD §2.1), only the mapper below changes — the
// contract, and therefore every consumer of it, stays exactly as it is.

import { randomUUID } from "node:crypto";
import type { AnnualizedUsage, ExtractionMeta, UtilityBillExtraction } from "./schema";

export const EXTRACTION_VERSION = "greenlight-ocr@0.2.0-gemini-only";

export type FieldSource = "textract_query" | "textract_form" | "textract_line" | "gemini" | "user";

export interface BoundingBox {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ExtractedField<T> {
  value: T | null;
  rawValue: string | null;
  source: FieldSource;
  /**
   * Per-field confidence. Null on the Gemini-only path — the model returns one
   * confidence for the whole document, and splitting that across fields would be
   * exactly the fake precision PRD §2.5 warns against. Textract populates this
   * per field when it lands.
   */
  confidence: number | null;
  /** Empty on the Gemini-only path; Textract supplies real coordinates. */
  evidence: BoundingBox[];
  needsConfirmation: boolean;
  validationErrors: string[];
}

export interface ServiceLocation {
  city: string | null;
  provinceState: string | null;
  /** Prefix only — the full postal code never leaves the extraction layer. */
  postalCodePrefix: string | null;
  country: string | null;
}

export interface TimeOfUseUsage {
  onPeakKwh: number | null;
  midPeakKwh: number | null;
  offPeakKwh: number | null;
}

export interface UtilityBill {
  documentId: string;
  documentType: UtilityBillExtraction["documentType"];
  extractionVersion: string;

  provider: ExtractedField<string>;
  accountNumberMasked: ExtractedField<string>;
  billingPeriodStart: ExtractedField<string>;
  billingPeriodEnd: ExtractedField<string>;
  billingDays: ExtractedField<number>;
  dueDate: ExtractedField<string>;

  totalDueCad: ExtractedField<number>;
  currentChargesCad: ExtractedField<number>;
  arrearsCad: ExtractedField<number>;

  electricityUsageKwh: ExtractedField<number>;
  naturalGasUsageM3: ExtractedField<number>;
  ratePlan: ExtractedField<string>;
  timeOfUse: ExtractedField<TimeOfUseUsage>;
  serviceLocation: ExtractedField<ServiceLocation>;

  /** Not in PRD §6.2, but the household profile (brief §48) needs both. */
  accountType: ExtractedField<string>;
  detectedHeatingClues: string[];

  /** Whole-document extraction confidence. Not an eligibility probability. */
  extractionConfidence: number;
  currency: string;
  /** Fields a human should resolve before this bill drives a recommendation. */
  fieldsNeedingConfirmation: string[];
}

// --- Mapping --------------------------------------------------------------

interface FieldOptions {
  /** The pipeline can't proceed without it, so a null value must be confirmed. */
  required?: boolean;
  validationErrors?: string[];
}

/**
 * Low whole-document confidence makes every field suspect, so it flips the
 * confirmation flag globally rather than being averaged into a per-field number.
 */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

function field<T>(
  value: T | null,
  rawValue: string | null,
  documentConfidence: number,
  options: FieldOptions = {}
): ExtractedField<T> {
  const validationErrors = options.validationErrors ?? [];
  const missingButNeeded = options.required === true && value === null;
  return {
    value,
    rawValue,
    source: "gemini",
    confidence: null,
    evidence: [],
    needsConfirmation:
      missingButNeeded || validationErrors.length > 0 || documentConfidence < LOW_CONFIDENCE_THRESHOLD,
    validationErrors,
  };
}

const asRaw = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

export function toCanonicalBill(
  extraction: UtilityBillExtraction,
  usage: AnnualizedUsage,
  meta: ExtractionMeta,
  documentId: string = randomUUID()
): UtilityBill {
  const c = extraction.confidence;

  // PRD §6.2 names these fields *Cad. Rather than silently mislabel a non-CAD
  // bill, the amount is kept and the mismatch is surfaced as a validation error.
  const currencyErrors =
    extraction.currency && extraction.currency !== "CAD"
      ? [`Bill currency is ${extraction.currency}, not CAD`]
      : [];

  const money = (value: number | null) => field(value, asRaw(value), c, { validationErrors: currencyErrors });

  const bill: UtilityBill = {
    documentId,
    documentType: extraction.documentType,
    extractionVersion: EXTRACTION_VERSION,

    provider: field(extraction.provider, extraction.provider, c, { required: true }),
    accountNumberMasked: field(
      extraction.accountNumberLast4 ? `••••${extraction.accountNumberLast4}` : null,
      null, // deliberately never the raw value
      c
    ),
    billingPeriodStart: field(extraction.billingPeriod.start, extraction.billingPeriod.start, c, { required: true }),
    billingPeriodEnd: field(extraction.billingPeriod.end, extraction.billingPeriod.end, c, { required: true }),
    // Calculated, not read: source stays "gemini" only in the sense that its
    // inputs came from there. The value itself is arithmetic (PRD §9.1).
    billingDays: {
      ...field(usage.billingDays, null, c),
      source: "gemini",
      validationErrors:
        usage.basis === "insufficient_data" ? ["Billing period dates were missing or unusable"] : [],
      needsConfirmation: usage.billingDays === null,
    },
    dueDate: field(extraction.dueDate, extraction.dueDate, c),

    totalDueCad: money(extraction.totalAmount),
    currentChargesCad: money(extraction.currentCharges),
    arrearsCad: money(extraction.arrears),

    electricityUsageKwh: field(extraction.electricity?.usageKwh ?? null, asRaw(extraction.electricity?.usageKwh), c),
    naturalGasUsageM3: field(extraction.naturalGas?.usageM3 ?? null, asRaw(extraction.naturalGas?.usageM3), c),
    ratePlan: field(extraction.ratePlan, extraction.ratePlan, c),
    timeOfUse: field(extraction.timeOfUse, null, c),
    serviceLocation: field(
      {
        city: extraction.serviceAddress.city,
        provinceState: extraction.serviceAddress.provinceState,
        // Already masked to a prefix upstream; strip the placeholder suffix.
        postalCodePrefix: extraction.serviceAddress.postalCode?.replace(/\s*\*+$/, "").trim() || null,
        country: extraction.serviceAddress.country,
      },
      null,
      c,
      { required: true }
    ),

    accountType: field(extraction.accountType === "unknown" ? null : extraction.accountType, extraction.accountType, c),
    detectedHeatingClues: extraction.detectedHeatingClues,

    extractionConfidence: extraction.confidence,
    currency: extraction.currency,
    fieldsNeedingConfirmation: [],
  };

  // A household with no metered consumption at all can't be assessed, but either
  // fuel satisfies the requirement — so it's checked across the pair, not per field.
  if (bill.electricityUsageKwh.value === null && bill.naturalGasUsageM3.value === null) {
    bill.electricityUsageKwh.needsConfirmation = true;
    bill.naturalGasUsageM3.needsConfirmation = true;
    bill.electricityUsageKwh.validationErrors.push("No metered consumption found on this bill");
  }

  bill.fieldsNeedingConfirmation = Object.entries(bill)
    .filter(([, v]) => v && typeof v === "object" && "needsConfirmation" in v && v.needsConfirmation)
    .map(([k]) => k);

  void meta; // meta travels alongside the bill, not inside the contract
  return bill;
}
