// Gemini SDK layer. Server-only — this file reads GEMINI_API_KEY and must never
// be imported from a client component.
//
// SDK surface verified against the installed package's own typings
// (node_modules/@google/genai/dist/genai.d.ts @ 2.17.1), not from memory:
//   - ai.models.generateContent({ model, contents, config })
//   - config.responseMimeType + config.responseJsonSchema for structured output
//   - documents are sent as parts: { inlineData: { mimeType, data: base64 } }
//   - response.text is a getter returning string | undefined
//
// Note from those typings: responseJsonSchema supports only a subset of JSON
// Schema, and "$schema" is not in the supported keyword list — hence the strip
// in toGeminiJsonSchema below.

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Current stable multimodal model — reads text, images, and PDFs, which covers
// every bill format the product accepts (brief §8: PDF, PNG, JPG).
export const DEFAULT_MODEL = "gemini-3.6-flash";

export function getModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export function hasLiveGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Zod emits "$schema", which responseJsonSchema does not list as supported.
export function toGeminiJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json["$schema"];
  return json;
}

export interface DocumentPrompt {
  /** Base64 file bytes, no data: URI prefix. */
  fileBase64: string;
  mimeType: string;
  /** Prompt turns sent before the document, in order. */
  instructions: string[];
  /** Omitted on the fallback attempt, when the model rejects the schema itself. */
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
}

/** One raw call: prompt + document in, model's JSON text out. No validation here. */
export async function generateDocumentJson(input: DocumentPrompt): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: [
      {
        role: "user",
        parts: [
          ...input.instructions.map((text) => ({ text })),
          { inlineData: { mimeType: input.mimeType, data: input.fileBase64 } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      ...(input.jsonSchema ? { responseJsonSchema: input.jsonSchema } : {}),
      // Bill reading is a transcription task — creativity is a defect here.
      temperature: 0,
      abortSignal: input.signal,
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Gemini returned an empty response");
  return raw;
}
