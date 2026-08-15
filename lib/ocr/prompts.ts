// Every Gemini prompt for the extraction layer lives here (brief §46: "do not
// scatter prompts throughout components"; PRD §14 puts it at ai/prompts.ts).
// Nothing in this file calls the model or reads secrets — it only builds
// strings, so it stays easy to diff, review, and test.

// Shared rules for any document-reading prompt. Kept separate from the task text
// so the retry prompt can restate them without drifting out of sync.
const DOCUMENT_READING_RULES = `Rules:
- Extract only what is actually printed on the document. Never guess, never infer, never average.
- If a field is not printed, use null (or an empty array), and add a short human-readable label for it to missingCriticalFields.
- Numbers must be plain numbers: no currency symbols, no thousands separators, no units.
- Dates must be ISO 8601 (YYYY-MM-DD). If only a month and year are printed, use the first day of that month.
- Never output a full account number. Output only its last 4 characters in accountNumberLast4, or null if none is printed.
- detectedHeatingClues are short phrases, quoted or closely paraphrased from the document, that hint at the heating fuel or system (for example "natural gas delivery charge", "electric heating rate class"). Only include clues the document actually supports.
- confidence is your own calibrated confidence (0 to 1) that the whole extraction is correct. Lower it for blurry scans, photographed pages, partial pages, cropped totals, or unfamiliar bill layouts.`;

// Field notes shared by the direct-read and normalize-Textract paths. These are
// the distinctions that actually decide program eligibility downstream, so they
// are spelled out rather than left to the model's judgement.
const FIELD_NOTES = `Notes on specific fields:
- provider is the utility company that issued the bill, as printed (for example "Toronto Hydro", "Enbridge Gas"). Not the payment processor, not the bank.
- accountType is "residential" unless the document clearly shows a commercial, industrial, or general-service rate class.
- electricity must be null when the bill covers no electricity. Same for naturalGas. A combined bill fills in both.
- usageKwh and usageM3 are the consumption billed for this period only — not a year-to-date total, not a forecast, not a comparison figure from last year's chart.
- totalAmount is the full amount due on this bill. currentCharges is this period's charges alone. arrears is any overdue balance carried forward from a previous bill. If the bill shows only one number, put it in totalAmount and leave the other two null — do not split it yourself.
- ratePlan is the pricing plan as printed, for example "RPP - Tiered", "Time-of-Use", "Ultra-Low Overnight".
- timeOfUse is the on-peak / mid-peak / off-peak kWh split, and must be null unless the bill actually breaks usage out that way.
- dueDate is the payment due date, not the bill issue date and not the period end.
- documentType describes what the document is. Use "other" for anything that is not a utility bill.`;

export const BILL_EXTRACTION_PROMPT = `You are reading a residential utility bill (electricity, natural gas, or a combined bill) for a household sustainability tool. The input may be a PDF, a scan, or a phone photo of a paper bill.

Read the document and return the structured extraction defined by the response schema.

${DOCUMENT_READING_RULES}

${FIELD_NOTES}
- If the document is not a utility bill at all, set documentType to "other", return nulls throughout, set confidence near 0, and put "document does not appear to be a utility bill" in missingCriticalFields.`;

/**
 * The PRD §2.1 path: Textract has already done the OCR, and Gemini's job is
 * narrowed to semantic normalization — mapping messy OCR output onto the
 * canonical schema. Deliberately forbids adding anything Textract did not see,
 * which is the whole reason for putting a deterministic OCR layer in front.
 */
export function textractNormalizationPrompt(textractText: string): string {
  return `Amazon Textract has already read a residential utility bill. Below is its raw output: detected lines, form key/value pairs, and query answers.

Your job is semantic normalization ONLY. Map what Textract found onto the response schema. You are not reading an image and you may not add information Textract did not detect — if something is absent from the text below, it is null.

${DOCUMENT_READING_RULES}

${FIELD_NOTES}

Additional rules for this mode:
- Where Textract's output is contradictory (the same field detected twice with different values), pick the one printed in the most bill-like context, and add a short note about the conflict to missingCriticalFields so a human can confirm it.
- OCR damage is expected. "1,O47 kWh" is 1047. But if a number is too damaged to read confidently, return null rather than a guess.
- Set confidence based on how cleanly Textract's output maps onto the schema, not on how confident you feel about the underlying bill.

Textract output:
---
${textractText}
---`;
}

// Sent as an extra turn when a response fails schema validation. Restating the
// rules beats re-sending the same prompt: the failure is nearly always a format
// slip (a "$1,204.00" string, a bare year) rather than a misreading.
export function billExtractionRetryPrompt(validationError: string): string {
  return `Your previous response did not match the required schema.

Validation error:
${validationError}

Read the same document again and return a corrected response that satisfies the schema exactly.

${DOCUMENT_READING_RULES}`;
}

// Used only on the fallback attempt, when the API rejected the JSON schema
// itself and the shape has to be described in prose instead.
export const BILL_EXTRACTION_SHAPE_HINT = `Return a single JSON object with exactly these keys:
{
  "documentType": "electricity_bill" | "natural_gas_bill" | "combined_utility_bill" | "water_bill" | "other",
  "provider": string | null,
  "accountType": "residential" | "commercial" | "unknown",
  "accountNumberLast4": string | null,
  "serviceAddress": { "city": string|null, "provinceState": string|null, "postalCode": string|null, "country": string|null },
  "billingPeriod": { "start": string|null, "end": string|null },
  "dueDate": string | null,
  "electricity": { "usageKwh": number|null, "cost": number|null } | null,
  "naturalGas": { "usageM3": number|null, "cost": number|null } | null,
  "ratePlan": string | null,
  "timeOfUse": { "onPeakKwh": number|null, "midPeakKwh": number|null, "offPeakKwh": number|null } | null,
  "totalAmount": number | null,
  "currentCharges": number | null,
  "arrears": number | null,
  "currency": string,
  "detectedHeatingClues": string[],
  "confidence": number,
  "missingCriticalFields": string[]
}
Output only the JSON object. No markdown fences, no commentary.`;
