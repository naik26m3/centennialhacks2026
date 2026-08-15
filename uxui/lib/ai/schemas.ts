import { z } from "zod";

// Structured-output schemas for validating Gemini responses. In demo mode nothing
// calls these against a live model, but a real GeminiAnalysisProvider (lib/ai/gemini.ts)
// should validate every response against these before it touches financial logic —
// per the brief's rule: retry, fail gracefully, never inject unvalidated AI output
// into the calculation layer.

export const BillExtractionSchema = z.object({
  provider: z.string().nullable(),
  accountType: z.enum(["residential", "commercial", "unknown"]),
  serviceAddress: z.object({
    city: z.string().nullable(),
    provinceState: z.string().nullable(),
    postalCode: z.string().nullable(),
    country: z.string().nullable(),
  }),
  billingPeriod: z.object({ start: z.string().nullable(), end: z.string().nullable() }),
  electricity: z.object({ usageKwh: z.number().nullable(), cost: z.number().nullable() }).nullable(),
  naturalGas: z.object({ usageM3: z.number().nullable(), cost: z.number().nullable() }).nullable(),
  totalAmount: z.number().nullable(),
  currency: z.string(),
  detectedHeatingClues: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  missingCriticalFields: z.array(z.string()),
});

export const EligibilityAssessmentSchema = z.object({
  status: z.enum(["likely_eligible", "possibly_eligible", "unlikely_eligible", "insufficient_information"]),
  confidence: z.number().min(0).max(1),
  satisfiedCriteria: z.array(z.string()),
  missingInformation: z.array(z.string()),
  disqualifiers: z.array(z.string()),
  explanation: z.string(),
});

export type BillExtractionResult = z.infer<typeof BillExtractionSchema>;
export type EligibilityAssessmentResult = z.infer<typeof EligibilityAssessmentSchema>;
