import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const DEFAULT_CHAT_MODEL = "google/gemini-3.6-flash";
export const DEFAULT_EMBEDDING_MODEL = "google/gemini-embedding-2-preview";
export const EMBEDDING_DIMENSIONS = 768;

export function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

  return createOpenRouter({
    apiKey,
    compatibility: "strict",
    headers: { "X-Title": "Greenlight" },
  });
}
