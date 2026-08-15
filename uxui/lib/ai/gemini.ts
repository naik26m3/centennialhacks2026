// Real Gemini wiring. Server-only — this file must never be imported from a
// client component, since it reads GEMINI_API_KEY.
//
// SDK: @google/genai. Verified against the installed package's own type
// definitions (node_modules/@google/genai/dist/node/node.d.ts) rather than
// assumed from memory, per this repo's AGENTS.md rule — the public docs site
// mixes examples from an older generateContent-based surface and a newer
// interactions.create() surface, and disagreed with itself across pages.
// The installed SDK confirms: ai.models.generateContent with
// config.responseMimeType / config.responseJsonSchema, and inline files as
// { inlineData: { mimeType, data } }.

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { HouseholdProfile, IncentiveProgram, UtilityBillExtraction } from "@/lib/types";
import {
  BatchEligibilityAssessmentSchema,
  BillExtractionBatchSchema,
  EligibilityAssessmentResult,
} from "@/lib/ai/schemas";

// gemini-3.6-flash: current stable model as of implementation time, supports
// text/image/PDF input — matches the bill formats this app accepts.
const MODEL = "gemini-3.6-flash";

// The SDK's own default retry policy (node_modules/@google/genai's
// HttpRetryOptions) is up to 5 attempts with backoff maxing out at 60s
// between retries — under sustained rate-limiting that can legitimately push
// total wall-clock time to several minutes with no visible progress. This
// app's whole safety model is "never let a flaky live call take down the
// demo" (README), so a slow retry loop is worse than failing fast: bound
// each call to one retry and a real timeout so a bad request fails quickly
// and falls back to the demo fixtures instead of hanging.
const REQUEST_HTTP_OPTIONS = {
  timeout: 25000,
  retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 4 },
};

export function hasLiveGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const BILL_EXTRACTION_PROMPT = `You are reading one or more residential utility bill images or PDFs for a household sustainability tool — they may be different utility types (electricity, natural gas), different months of the same account, or both. Extract only what is actually printed on each bill — never guess or infer values that aren't shown. If a field isn't present, use null (or an empty array/list where appropriate) and add a short label for it to missingCriticalFields. detectedHeatingClues should be short phrases quoting or paraphrasing anything on the bill that hints at the heating fuel or system (e.g. "natural gas billing structure", "electric heating rate class") — do not fabricate clues that aren't supported by the bill text. primaryHeatingHint is your own interpretation of what fuel that specific bill indicates the home most likely heats with — read the bill's language carefully, including negations (a bill that explicitly says there is no natural gas service, or that only itemizes electricity usage, indicates "electric" or another non-gas fuel, not "natural_gas"). Use "unknown" only if the bill genuinely gives no basis to infer this. confidence is your own calibrated confidence (0-1) in that bill's extraction. Return exactly one extraction per image you were given, each tagged with sourceFileIndex matching the 0-indexed order the images appeared in this request.`;

export async function analyzeBillsBatchWithGemini(
  files: { mimeType: string; data: string }[]
): Promise<UtilityBillExtraction[]> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: BILL_EXTRACTION_PROMPT }, ...files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } }))],
      },
    ],
    config: {
      httpOptions: REQUEST_HTTP_OPTIONS,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(BillExtractionBatchSchema),
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Gemini returned an empty response for bill extraction");

  const parsed = BillExtractionBatchSchema.parse(JSON.parse(raw));
  return parsed.extractions
    .slice()
    .sort((a, b) => a.sourceFileIndex - b.sourceFileIndex)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately dropping sourceFileIndex, it's not part of UtilityBillExtraction
    .map(({ sourceFileIndex, ...extraction }) => extraction);
}

function batchEligibilityPrompt(programs: IncentiveProgram[], household: HouseholdProfile, bills: UtilityBillExtraction[]): string {
  const programList = programs
    .map(
      (p) =>
        `- id: "${p.id}"\n  name: ${p.name}\n  description: ${p.description}\n  eligible heating types: ${
          p.eligibility.heatingTypes === "any" ? "any" : p.eligibility.heatingTypes.join(", ")
        }\n  requires a prior home energy assessment: ${p.eligibility.requiresAssessment}`
    )
    .join("\n\n");

  const detectedHeatingClues = bills.flatMap((b) => b.detectedHeatingClues);

  return `You are assessing whether a household likely qualifies for several energy-incentive programs, based only on the facts given below. Do not invent facts. Region and homeowner status are checked separately and deterministically for every program — do not re-assess them; focus on the remaining eligibility criteria per program (heating type fit, assessment/documentation prerequisites, anything else implied by that program's description).

Household:
- Primary heating: ${household.primaryHeating}
- Dwelling type: ${household.dwellingType}
- Detected heating clues across the uploaded bill(s): ${detectedHeatingClues.join("; ") || "none"}
- Existing equipment: smart thermostat = ${household.existingEquipment.smartThermostat}, heat pump = ${household.existingEquipment.heatPump}

Programs to assess:
${programList}

Return exactly one assessment per program above, each with programId set to that program's exact id. satisfiedCriteria / missingInformation / disqualifiers should each be short, specific phrases (not full sentences) describing individual criteria, suitable for display as a checklist item. explanation is a 1-2 sentence plain-language summary for the household, specific to that one program.`;
}

// One call covering every program, not one call per program — see the
// comment on BatchEligibilityAssessmentSchema for why.
export async function assessEligibilityBatchWithGemini(
  programs: IncentiveProgram[],
  household: HouseholdProfile,
  bills: UtilityBillExtraction[]
): Promise<Record<string, EligibilityAssessmentResult>> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: batchEligibilityPrompt(programs, household, bills),
    config: {
      httpOptions: REQUEST_HTTP_OPTIONS,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(BatchEligibilityAssessmentSchema),
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Gemini returned an empty response assessing eligibility");

  const parsed = BatchEligibilityAssessmentSchema.parse(JSON.parse(raw));
  const byProgramId: Record<string, EligibilityAssessmentResult> = {};
  for (const { programId, ...assessment } of parsed.assessments) {
    byProgramId[programId] = assessment;
  }
  return byProgramId;
}
