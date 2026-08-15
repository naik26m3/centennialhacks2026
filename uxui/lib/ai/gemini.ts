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
import { BillExtractionResult, BillExtractionSchema, EligibilityAssessmentResult, EligibilityAssessmentSchema } from "@/lib/ai/schemas";

// gemini-3.6-flash: current stable model as of implementation time, supports
// text/image/PDF input — matches the bill formats this app accepts.
const MODEL = "gemini-3.6-flash";

export function hasLiveGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const BILL_EXTRACTION_PROMPT = `You are reading a residential utility bill (electricity or natural gas) image or PDF for a household sustainability tool. Extract only what is actually printed on the bill — never guess or infer values that aren't shown. If a field isn't present, use null (or an empty array/list where appropriate) and add a short label for it to missingCriticalFields. detectedHeatingClues should be short phrases quoting or paraphrasing anything on the bill that hints at the heating fuel or system (e.g. "natural gas billing structure", "electric heating rate class") — do not fabricate clues that aren't supported by the bill text. confidence is your own calibrated confidence (0-1) in the overall extraction.`;

export async function analyzeBillWithGemini(fileBase64: string, mimeType: string): Promise<UtilityBillExtraction> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: BILL_EXTRACTION_PROMPT }, { inlineData: { mimeType, data: fileBase64 } }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(BillExtractionSchema),
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Gemini returned an empty response for bill extraction");

  const result: BillExtractionResult = BillExtractionSchema.parse(JSON.parse(raw));
  return result;
}

function eligibilityPrompt(program: IncentiveProgram, household: HouseholdProfile, bill: UtilityBillExtraction): string {
  return `You are assessing whether a household likely qualifies for an energy-incentive program, based only on the facts given below. Do not invent facts. Region and homeowner status are checked separately and deterministically — do not re-assess them; focus on the remaining eligibility criteria (heating type fit, assessment/documentation prerequisites, anything else implied by the program description).

Program: ${program.name}
Program description: ${program.description}
Eligible heating types: ${program.eligibility.heatingTypes === "any" ? "any" : program.eligibility.heatingTypes.join(", ")}
Requires a prior home energy assessment: ${program.eligibility.requiresAssessment}

Household:
- Primary heating: ${household.primaryHeating}
- Dwelling type: ${household.dwellingType}
- Detected heating clues from the bill: ${bill.detectedHeatingClues.join("; ") || "none"}
- Existing equipment: smart thermostat = ${household.existingEquipment.smartThermostat}, heat pump = ${household.existingEquipment.heatPump}

satisfiedCriteria / missingInformation / disqualifiers should each be short, specific phrases (not full sentences) describing individual criteria, suitable for display as a checklist item. explanation is a 1-2 sentence plain-language summary for the household.`;
}

export async function assessEligibilityWithGemini(
  program: IncentiveProgram,
  household: HouseholdProfile,
  bill: UtilityBillExtraction
): Promise<EligibilityAssessmentResult> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: eligibilityPrompt(program, household, bill),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(EligibilityAssessmentSchema),
    },
  });

  const raw = response.text;
  if (!raw) throw new Error(`Gemini returned an empty response assessing eligibility for ${program.id}`);

  return EligibilityAssessmentSchema.parse(JSON.parse(raw));
}
