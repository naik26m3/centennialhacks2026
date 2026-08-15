import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const DATABASE_EMBEDDING_DIMENSIONS = 768;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getOpenRouterChatModel(): string {
  return requiredEnvironment("OPENROUTER_CHAT_MODEL");
}

export const EMBEDDING_DIMENSIONS = DATABASE_EMBEDDING_DIMENSIONS;

export function getOpenRouterEmbeddingModel(): string {
  return requiredEnvironment("OPENROUTER_EMBEDDING_MODEL");
}

export function getEmbeddingDimensions(): number {
  const dimensions = Number(requiredEnvironment("EMBEDDING_DIMENSIONS"));
  if (!Number.isInteger(dimensions) || dimensions !== DATABASE_EMBEDDING_DIMENSIONS) {
    throw new RangeError(
      `EMBEDDING_DIMENSIONS must be ${DATABASE_EMBEDDING_DIMENSIONS} for the current database schema`,
    );
  }
  return dimensions;
}

export function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

  return createOpenRouter({
    apiKey,
    compatibility: "strict",
    headers: { "X-Title": "Greenlight" },
  });
}
